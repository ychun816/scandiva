const { fetchJson, toDate } = require('./http');

// Greenhouse Job Board API: public, returns every open job on the board.
async function fetchJobs(source) {
  const board = encodeURIComponent(source.board);
  const data = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs`);
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  return jobs
    .filter((j) => j && j.id && j.absolute_url && j.title)
    .map((j) => ({
      externalId: String(j.id),
      url: j.absolute_url,
      company: j.company_name || source.board,
      title: j.title,
      location: j.location?.name || null,
      postedAt: toDate(j.first_published || j.updated_at),
    }));
}

module.exports = { fetchJobs };
