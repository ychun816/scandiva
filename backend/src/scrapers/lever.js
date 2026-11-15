const { fetchJson, normalizeContract, toDate } = require('./http');

// Lever Postings API: public, returns every published posting for the company.
async function fetchJobs(source) {
  const company = encodeURIComponent(source.company);
  const data = await fetchJson(`https://api.lever.co/v0/postings/${company}?mode=json`);
  const jobs = Array.isArray(data) ? data : [];
  return jobs
    .filter((j) => j && j.id && j.hostedUrl && j.text)
    .map((j) => ({
      externalId: String(j.id),
      url: j.hostedUrl,
      company: source.company,
      title: j.text,
      location: j.categories?.location || null,
      contractType: normalizeContract(j.categories?.commitment),
      salary: j.salaryRange
        ? `${j.salaryRange.min ?? ''}-${j.salaryRange.max ?? ''} ${j.salaryRange.currency ?? ''}`.trim()
        : null,
      postedAt: toDate(j.createdAt),
    }));
}

module.exports = { fetchJobs };
