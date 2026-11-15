const prisma = require('../config/prisma');
const greenhouse = require('./greenhouse');
const lever = require('./lever');
const rss = require('./rss');

const ADAPTERS = { greenhouse, lever, rss };

const parseSources = (raw) => {
  try {
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

const sourceLabel = (s) => `${s.type}:${s.board || s.company || s.url}`;

// Every whitespace-separated query term must appear in the title; the location
// filter is a substring match, and postings with no location are kept.
const matches = (job, { query, location }) => {
  const title = job.title.toLowerCase();
  const terms = (query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.every((t) => title.includes(t))) return false;
  if (location && job.location && !job.location.toLowerCase().includes(location.toLowerCase())) return false;
  return true;
};

const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : null);

// Fetch every source of a search, store new postings, and record the outcome.
// One failing source never stops the others. Returns { added, lastError }.
async function runSearch(search) {
  const errors = [];
  let added = 0;

  for (const source of parseSources(search.sources)) {
    const adapter = ADAPTERS[source.type];
    if (!adapter) {
      errors.push(`${sourceLabel(source)}: unknown source type`);
      continue;
    }
    let jobs;
    try {
      jobs = await adapter.fetchJobs(source);
    } catch (err) {
      errors.push(`${sourceLabel(source)}: ${err.message}`);
      continue;
    }
    for (const job of jobs.filter((j) => matches(j, search))) {
      try {
        await prisma.jobPosting.create({
          data: {
            userId: search.userId,
            searchId: search.id,
            source: source.type,
            externalId: clip(job.externalId, 500),
            url: clip(job.url, 1000),
            company: clip(job.company, 200) || 'Unknown',
            title: clip(job.title, 300),
            location: clip(job.location, 200),
            salary: clip(job.salary, 100),
            contractType: job.contractType || null,
            postedAt: job.postedAt || null,
          },
        });
        added++;
      } catch (err) {
        // Already seen: the (userId, source, externalId) unique key is the dedup.
        if (err.code !== 'P2002') throw err;
      }
    }
  }

  const lastError = errors.length ? errors.join('; ').slice(0, 1000) : null;
  await prisma.jobSearch.update({
    where: { id: search.id },
    data: { lastRunAt: new Date(), lastError },
  });
  return { added, lastError };
}

module.exports = { runSearch, matches };
