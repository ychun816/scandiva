const crypto = require('crypto');
const Parser = require('rss-parser');
const { fetchText, toDate } = require('./http');

const parser = new Parser();

// Generic RSS/Atom feed. Feeds rarely carry a company field, so fall back to
// the feed title, then the item's host name.
async function fetchJobs(source) {
  const xml = await fetchText(source.url);
  let feed;
  try {
    feed = await parser.parseString(xml);
  } catch {
    throw new Error('invalid feed');
  }
  return (feed.items || [])
    .filter((item) => item.link && item.title)
    .map((item) => ({
      externalId: item.guid || item.id || crypto.createHash('sha1').update(item.link).digest('hex'),
      url: item.link,
      company: item.creator || feed.title || hostOf(item.link),
      title: item.title,
      location: null,
      postedAt: toDate(item.isoDate || item.pubDate),
    }));
}

const hostOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return 'Unknown';
  }
};

module.exports = { fetchJobs };
