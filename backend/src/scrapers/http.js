const { scraperUserAgent } = require('../config/env');
const { CONTRACT_TYPES } = require('../lib/validators');

const MAX_BYTES = 5 * 1024 * 1024;

// GET a URL as text with a hard timeout, our User-Agent and a response size cap.
// Throws an Error with a short, user-facing message on any failure.
async function fetchText(url, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': scraperUserAgent, Accept: 'application/json, application/xml, text/xml, */*' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const declared = Number(res.headers.get('content-length'));
    if (declared > MAX_BYTES) throw new Error('response too large');
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new Error('response too large');
    return text;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('timed out');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, opts) {
  const text = await fetchText(url, opts);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('invalid JSON');
  }
}

// Map a free-form commitment string ("Full Time", "Internship") onto CONTRACT_TYPES, or null.
const normalizeContract = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  const key = raw.toLowerCase().replace(/[\s_-]+/g, '');
  if (key.startsWith('intern')) return 'Intern';
  return CONTRACT_TYPES.find((c) => c.toLowerCase().replace(/[\s_-]+/g, '') === key) || null;
};

const toDate = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

module.exports = { fetchText, fetchJson, normalizeContract, toDate };
