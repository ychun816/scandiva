const prisma = require('../config/prisma');
const { runSearch } = require('./index');

const TICK_MS = 60 * 1000;
let running = false;

const isDue = (search, now) =>
  !search.lastRunAt || search.lastRunAt.getTime() + search.frequencyMin * 60 * 1000 <= now.getTime();

// Run every active search whose interval has elapsed, one at a time. Schedule
// state lives in the DB (lastRunAt), so a restart simply picks up where it left off.
async function tick(now = new Date()) {
  if (running) return 0;
  running = true;
  let ran = 0;
  try {
    const searches = await prisma.jobSearch.findMany({ where: { isActive: true } });
    for (const search of searches.filter((s) => isDue(s, now))) {
      try {
        await runSearch(search);
        ran++;
      } catch (err) {
        console.error(`Job search ${search.id} failed:`, err.message);
      }
    }
  } finally {
    running = false;
  }
  return ran;
}

function startScheduler() {
  const timer = setInterval(() => {
    tick().catch((err) => console.error('Job scheduler tick failed:', err.message));
  }, TICK_MS);
  timer.unref();
  return timer;
}

module.exports = { startScheduler, tick, isDue };
