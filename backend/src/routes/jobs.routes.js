const express = require('express');
const prisma = require('../config/prisma');
const { scraperMinIntervalMin } = require('../config/env');
const { isNotFound, validateJobSearch, JOB_POSTING_STATUSES } = require('../lib/validators');
const { runSearch } = require('../scrapers');
const { authenticateToken } = require('../middleware/auth');
const { idParam } = require('../middleware/errorHandler');

const router = express.Router();
router.param('id', idParam);

const RUN_COOLDOWN_MS = 5 * 60 * 1000;

// Sources are stored as a JSON string; hand them back to the client parsed.
const serializeSearch = (s) => {
  let sources = [];
  try {
    sources = JSON.parse(s.sources || '[]');
  } catch { /* corrupt row: show no sources */ }
  return { ...s, sources };
};

const searchData = ({ name, query, location, frequencyMin, sources, isActive }) => ({
  name: typeof name === 'string' ? name.trim().slice(0, 100) : undefined,
  query: typeof query === 'string' ? query.trim().slice(0, 200) : undefined,
  location: location === undefined ? undefined : (typeof location === 'string' && location.trim() ? location.trim().slice(0, 100) : null),
  frequencyMin,
  sources: sources === undefined ? undefined : JSON.stringify(sources.map(({ type, board, company, url }) => ({ type, board, company, url }))),
  isActive: typeof isActive === 'boolean' ? isActive : undefined,
});

// ----- Saved searches -----

router.get('/job-searches', authenticateToken, async (req, res) => {
  try {
    const searches = await prisma.jobSearch.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(searches.map(serializeSearch));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch job searches' });
  }
});

router.post('/job-searches', authenticateToken, async (req, res) => {
  const err = validateJobSearch(req.body, { minIntervalMin: scraperMinIntervalMin });
  if (err) return res.status(400).json({ error: err });
  try {
    const search = await prisma.jobSearch.create({
      data: { ...searchData(req.body), userId: req.user.id },
    });
    res.json(serializeSearch(search));
  } catch (error) {
    res.status(500).json({ error: 'Failed to create job search' });
  }
});

router.put('/job-searches/:id', authenticateToken, async (req, res) => {
  const err = validateJobSearch(req.body, { partial: true, minIntervalMin: scraperMinIntervalMin });
  if (err) return res.status(400).json({ error: err });
  try {
    const search = await prisma.jobSearch.update({
      where: { id: parseInt(req.params.id), userId: req.user.id },
      data: searchData(req.body),
    });
    res.json(serializeSearch(search));
  } catch (error) {
    if (isNotFound(error)) return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: 'Failed to update job search' });
  }
});

// Postings found by the search are kept; their searchId becomes null.
router.delete('/job-searches/:id', authenticateToken, async (req, res) => {
  try {
    await prisma.jobSearch.delete({ where: { id: parseInt(req.params.id), userId: req.user.id } });
    res.json({ message: 'Job search deleted' });
  } catch (error) {
    if (isNotFound(error)) return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: 'Failed to delete job search' });
  }
});

// Run a search now. The cooldown comes from lastRunAt, so it survives restarts.
router.post('/job-searches/:id/run', authenticateToken, async (req, res) => {
  try {
    const search = await prisma.jobSearch.findFirst({
      where: { id: parseInt(req.params.id), userId: req.user.id },
    });
    if (!search) return res.status(404).json({ error: 'Not found' });
    if (search.lastRunAt && Date.now() - search.lastRunAt.getTime() < RUN_COOLDOWN_MS) {
      return res.status(429).json({ error: 'This search ran less than 5 minutes ago. Try again shortly.' });
    }
    res.json(await runSearch(search));
  } catch (error) {
    res.status(500).json({ error: 'Failed to run job search' });
  }
});

// ----- Postings (the Job Inbox) -----

router.get('/job-postings', authenticateToken, async (req, res) => {
  const { status, searchId } = req.query;
  const where = { userId: req.user.id };
  if (status !== undefined) {
    if (!JOB_POSTING_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    where.status = status;
  }
  if (searchId !== undefined) {
    const n = Number(searchId);
    if (!Number.isInteger(n) || n <= 0) return res.status(400).json({ error: 'Invalid searchId' });
    where.searchId = n;
  }
  try {
    const postings = await prisma.jobPosting.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 500,
    });
    res.json(postings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch job postings' });
  }
});

// Triage only; `converted` is set by the convert route, never by hand.
router.patch('/job-postings/:id', authenticateToken, async (req, res) => {
  const { status } = req.body;
  if (!['new', 'saved', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: 'Status must be one of: new, saved, dismissed' });
  }
  try {
    const posting = await prisma.jobPosting.update({
      where: { id: parseInt(req.params.id), userId: req.user.id, status: { not: 'converted' } },
      data: { status },
    });
    res.json(posting);
  } catch (error) {
    if (isNotFound(error)) return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: 'Failed to update job posting' });
  }
});

// Turn a posting into a To Apply application on the board.
router.post('/job-postings/:id/convert', authenticateToken, async (req, res) => {
  try {
    const posting = await prisma.jobPosting.findFirst({
      where: { id: parseInt(req.params.id), userId: req.user.id },
    });
    if (!posting) return res.status(404).json({ error: 'Not found' });
    if (posting.applicationId) return res.status(409).json({ error: 'Already added to the board' });

    const application = await prisma.$transaction(async (tx) => {
      const created = await tx.application.create({
        data: {
          company: posting.company,
          position: posting.title,
          link: posting.url,
          platform: posting.source,
          salary: posting.salary,
          contractType: posting.contractType,
          notes: posting.location ? `Location: ${posting.location}` : null,
          status: 'To Apply',
          userId: req.user.id,
        },
      });
      await tx.jobPosting.update({
        where: { id: posting.id },
        data: { status: 'converted', applicationId: created.id },
      });
      return created;
    });
    res.json({ ...application, stages: [], latestStage: null });
  } catch (error) {
    // A concurrent convert won the race on the applicationId unique key.
    if (error.code === 'P2002') return res.status(409).json({ error: 'Already added to the board' });
    res.status(500).json({ error: 'Failed to convert job posting' });
  }
});

module.exports = router;
