const express = require('express');
const prisma = require('../config/prisma');
const { isNotFound, validateApplicationFields } = require('../lib/validators');
const { authenticateToken } = require('../middleware/auth');
const { idParam } = require('../middleware/errorHandler');

const router = express.Router();
router.param('id', idParam);

router.get('/applications', authenticateToken, async (req, res) => {
  try {
    const applications = await prisma.application.findMany({
      where: { userId: req.user.id },
      include: { stages: { orderBy: { date: 'desc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    const withLatest = applications.map((app) => ({
      ...app,
      latestStage: app.stages && app.stages.length > 0 ? app.stages[0] : null,
    }));
    res.json(withLatest);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

router.post('/applications', authenticateToken, async (req, res) => {
  const { company, position, link, platform, status, notes, salary, isStarred, contractType, isArchived } = req.body;
  if (!company || typeof company !== 'string' || !company.trim() ||
      !position || typeof position !== 'string' || !position.trim()) {
    return res.status(400).json({ error: 'Company and position are required' });
  }
  const domainError = validateApplicationFields({ status, contractType });
  if (domainError) return res.status(400).json({ error: domainError });
  try {
    const application = await prisma.application.create({
      data: {
        company, position, link, platform,
        status: status || 'To Apply',
        isArchived: isArchived || false,
        notes, salary,
        isStarred: isStarred || false,
        contractType,
        userId: req.user.id,
      },
    });
    res.json(application);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create application' });
  }
});

router.put('/applications/:id', authenticateToken, async (req, res) => {
  const { status, notes, company, position, link, platform, salary, isStarred, contractType, isArchived } = req.body;
  const domainError = validateApplicationFields({ status, contractType });
  if (domainError) return res.status(400).json({ error: domainError });
  try {
    // `isArchived` is orthogonal to `status`, so archiving never overwrites status.
    const application = await prisma.application.update({
      where: { id: parseInt(req.params.id), userId: req.user.id },
      data: { status, isArchived, notes, company, position, link, platform, salary, isStarred, contractType },
    });
    res.json(application);
  } catch (error) {
    if (isNotFound(error)) return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: 'Failed to update application' });
  }
});

router.delete('/applications/:id', authenticateToken, async (req, res) => {
  try {
    await prisma.application.delete({ where: { id: parseInt(req.params.id), userId: req.user.id } });
    res.json({ message: 'Application deleted' });
  } catch (error) {
    if (isNotFound(error)) return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: 'Failed to delete application' });
  }
});

// Link (or unlink) a resume — both the application and the resume must be owned.
router.put('/applications/:id/resume', authenticateToken, async (req, res) => {
  const { resumeId } = req.body;
  try {
    let linkedId = null;
    if (resumeId !== null && resumeId !== undefined && resumeId !== '') {
      linkedId = Number(resumeId);
      if (!Number.isInteger(linkedId) || linkedId <= 0) {
        return res.status(400).json({ error: 'Invalid resume id' });
      }
      const resume = await prisma.resume.findUnique({ where: { id: linkedId, userId: req.user.id } });
      if (!resume) return res.status(404).json({ error: 'Resume not found' });
    }
    const application = await prisma.application.update({
      where: { id: parseInt(req.params.id), userId: req.user.id },
      data: { resumeId: linkedId },
    });
    res.json(application);
  } catch (error) {
    if (isNotFound(error)) return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: 'Failed to link resume' });
  }
});

// Link (or unlink) a motivation-letter version — both sides must be owned.
router.put('/applications/:id/letter-version', authenticateToken, async (req, res) => {
  const { letterVersionId } = req.body;
  try {
    let linkedId = null;
    if (letterVersionId !== null && letterVersionId !== undefined && letterVersionId !== '') {
      linkedId = Number(letterVersionId);
      if (!Number.isInteger(linkedId) || linkedId <= 0) {
        return res.status(400).json({ error: 'Invalid letter version id' });
      }
      const version = await prisma.letterVersion.findUnique({ where: { id: linkedId, userId: req.user.id } });
      if (!version) return res.status(404).json({ error: 'Letter version not found' });
    }
    const application = await prisma.application.update({
      where: { id: parseInt(req.params.id), userId: req.user.id },
      data: { letterVersionId: linkedId },
    });
    res.json(application);
  } catch (error) {
    if (isNotFound(error)) return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: 'Failed to link letter version' });
  }
});

module.exports = router;
