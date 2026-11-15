import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { makeUser } from './helpers.js';
import prisma from '../src/config/prisma.js';
import { tick, isDue } from '../src/scrapers/scheduler.js';
import { matches } from '../src/scrapers/index.js';

// Upstream job sources are never hit: global.fetch is stubbed with fixtures.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

const FIXTURES = {
  'boards-api.greenhouse.io': () => fixture('greenhouse.json'),
  'api.lever.co': () => fixture('lever.json'),
  'feeds.example.com': () => fixture('feed.xml'),
};

const stubFetch = (overrides = {}) =>
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const host = new URL(url).hostname;
    const handler = overrides[host] || FIXTURES[host];
    if (!handler) return new Response('not found', { status: 404 });
    const body = handler();
    if (body instanceof Response) return body;
    return new Response(body, { status: 200 });
  }));

const SOURCES = [
  { type: 'greenhouse', board: 'acme' },
  { type: 'lever', company: 'globex' },
  { type: 'rss', url: 'https://feeds.example.com/backend.xml' },
];

const newSearch = (agent, overrides = {}) =>
  agent.post('/job-searches').send({ name: 'Backend', query: 'backend engineer', frequencyMin: 1440, sources: SOURCES, ...overrides });

beforeEach(() => stubFetch());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('job searches CRUD', () => {
  it('creates, lists, updates and deletes a search', async () => {
    const { agent } = await makeUser();
    const created = await newSearch(agent);
    expect(created.status).toBe(200);
    expect(created.body.sources).toHaveLength(3);
    expect(created.body.isActive).toBe(true);

    const list = await agent.get('/job-searches');
    expect(list.body.map((s) => s.id)).toEqual([created.body.id]);

    const put = await agent.put(`/job-searches/${created.body.id}`).send({ name: 'Renamed', isActive: false });
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({ name: 'Renamed', isActive: false, query: 'backend engineer' });

    const del = await agent.delete(`/job-searches/${created.body.id}`);
    expect(del.status).toBe(200);
    expect((await agent.get('/job-searches')).body).toEqual([]);
  });

  it.each([
    [{ name: '' }, /Name/],
    [{ query: '  ' }, /Query/],
    [{ frequencyMin: 5 }, /frequencyMin/],
    [{ sources: [] }, /sources/],
    [{ sources: [{ type: 'linkedin' }] }, /type/],
    [{ sources: [{ type: 'greenhouse', board: '../admin' }] }, /board/],
    [{ sources: [{ type: 'rss', url: 'file:///etc/passwd' }] }, /http/],
  ])('rejects invalid payload %j', async (overrides, message) => {
    const { agent } = await makeUser();
    const res = await newSearch(agent, overrides);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
  });

  it("returns 404 for another user's search", async () => {
    const { agent: owner } = await makeUser();
    const { agent: other } = await makeUser();
    const { body: search } = await newSearch(owner);
    expect((await other.put(`/job-searches/${search.id}`).send({ name: 'x' })).status).toBe(404);
    expect((await other.delete(`/job-searches/${search.id}`)).status).toBe(404);
    expect((await other.post(`/job-searches/${search.id}/run`)).status).toBe(404);
    expect((await other.get('/job-searches')).body).toEqual([]);
  });
});

describe('running a search', () => {
  it('stores matching postings from every source, filtered by query', async () => {
    const { agent } = await makeUser();
    const { body: search } = await newSearch(agent);
    const run = await agent.post(`/job-searches/${search.id}/run`);
    expect(run.status).toBe(200);
    expect(run.body).toEqual({ added: 5, lastError: null });

    const { body: postings } = await agent.get('/job-postings');
    const titles = postings.map((p) => p.title).sort();
    expect(titles).toEqual([
      'Backend Engineer (Node.js)',
      'Backend Engineer Intern',
      'Backend Engineer without guid',
      'Backend Engineer, Payments',
      'Senior Backend Engineer',
    ]);
    const intern = postings.find((p) => p.source === 'lever');
    expect(intern).toMatchObject({ company: 'globex', contractType: 'Intern', location: 'Paris', status: 'new' });
  });

  it('applies the location filter but keeps postings with no location', async () => {
    const { agent } = await makeUser();
    const { body: search } = await newSearch(agent, { location: 'paris' });
    const run = await agent.post(`/job-searches/${search.id}/run`);
    // Drops only the "Remote" Greenhouse job; RSS items have no location.
    expect(run.body.added).toBe(4);
  });

  it('dedups on re-run and enforces the cooldown', async () => {
    const { agent } = await makeUser();
    const { body: search } = await newSearch(agent);
    await agent.post(`/job-searches/${search.id}/run`);

    const again = await agent.post(`/job-searches/${search.id}/run`);
    expect(again.status).toBe(429);

    // Past the cooldown, the same fixtures add nothing new.
    await prisma.jobSearch.update({ where: { id: search.id }, data: { lastRunAt: new Date(Date.now() - 10 * 60 * 1000) } });
    const later = await agent.post(`/job-searches/${search.id}/run`);
    expect(later.body.added).toBe(0);
    expect((await agent.get('/job-postings')).body).toHaveLength(5);
  });

  it('keeps going when one source fails and records the error', async () => {
    stubFetch({ 'api.lever.co': () => new Response('boom', { status: 503 }) });
    const { agent } = await makeUser();
    const { body: search } = await newSearch(agent);
    const run = await agent.post(`/job-searches/${search.id}/run`);
    expect(run.body.added).toBe(4);
    expect(run.body.lastError).toBe('lever:globex: HTTP 503');
    const { body: [saved] } = await agent.get('/job-searches');
    expect(saved.lastError).toBe('lever:globex: HTTP 503');
    expect(saved.lastRunAt).toBeTruthy();
  });

  it('keeps postings when their search is deleted', async () => {
    const { agent } = await makeUser();
    const { body: search } = await newSearch(agent);
    await agent.post(`/job-searches/${search.id}/run`);
    await agent.delete(`/job-searches/${search.id}`);
    const { body: postings } = await agent.get('/job-postings');
    expect(postings).toHaveLength(5);
    expect(postings.every((p) => p.searchId === null)).toBe(true);
  });
});

describe('job postings', () => {
  const seeded = async () => {
    const user = await makeUser();
    const { body: search } = await newSearch(user.agent);
    await user.agent.post(`/job-searches/${search.id}/run`);
    const { body: postings } = await user.agent.get('/job-postings');
    return { ...user, search, postings };
  };

  it('filters by status and searchId, and validates both', async () => {
    const { agent, search, postings } = await seeded();
    await agent.patch(`/job-postings/${postings[0].id}`).send({ status: 'saved' });
    expect((await agent.get('/job-postings?status=saved')).body).toHaveLength(1);
    expect((await agent.get('/job-postings?status=new')).body).toHaveLength(4);
    expect((await agent.get(`/job-postings?searchId=${search.id}`)).body).toHaveLength(5);
    expect((await agent.get('/job-postings?status=bogus')).status).toBe(400);
    expect((await agent.get('/job-postings?searchId=abc')).status).toBe(400);
  });

  it('only allows triage statuses through PATCH', async () => {
    const { agent, postings } = await seeded();
    const res = await agent.patch(`/job-postings/${postings[0].id}`).send({ status: 'converted' });
    expect(res.status).toBe(400);
  });

  it('converts a posting into a To Apply application exactly once', async () => {
    const { agent, postings } = await seeded();
    const posting = postings.find((p) => p.source === 'lever');
    const res = await agent.post(`/job-postings/${posting.id}/convert`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      company: 'globex',
      position: 'Backend Engineer Intern',
      link: 'https://jobs.lever.co/globex/a1b2c3',
      platform: 'lever',
      contractType: 'Intern',
      status: 'To Apply',
    });

    const { body: apps } = await agent.get('/applications');
    expect(apps.map((a) => a.id)).toContain(res.body.id);

    const { body: [converted] } = await agent.get('/job-postings?status=converted');
    expect(converted.applicationId).toBe(res.body.id);

    expect((await agent.post(`/job-postings/${posting.id}/convert`)).status).toBe(409);
    expect((await agent.patch(`/job-postings/${posting.id}`).send({ status: 'new' })).status).toBe(404);
  });

  it("returns 404 for another user's posting", async () => {
    const { postings } = await seeded();
    const { agent: other } = await makeUser();
    expect((await other.patch(`/job-postings/${postings[0].id}`).send({ status: 'saved' })).status).toBe(404);
    expect((await other.post(`/job-postings/${postings[0].id}/convert`)).status).toBe(404);
    expect((await other.get('/job-postings')).body).toEqual([]);
  });

  it('removes searches and postings with the account', async () => {
    const { agent, user } = await seeded();
    expect((await agent.delete('/auth/account')).status).toBe(200);
    expect(await prisma.jobSearch.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.jobPosting.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe('scheduler', () => {
  it('isDue respects lastRunAt + frequencyMin', () => {
    const now = new Date('2026-11-15T12:00:00Z');
    expect(isDue({ lastRunAt: null, frequencyMin: 60 }, now)).toBe(true);
    expect(isDue({ lastRunAt: new Date('2026-11-15T11:00:00Z'), frequencyMin: 60 }, now)).toBe(true);
    expect(isDue({ lastRunAt: new Date('2026-11-15T11:30:00Z'), frequencyMin: 60 }, now)).toBe(false);
  });

  it('tick runs due, active searches only', async () => {
    const { agent } = await makeUser();
    const { body: due } = await newSearch(agent, { name: 'due' });
    const { body: fresh } = await newSearch(agent, { name: 'fresh' });
    const { body: paused } = await newSearch(agent, { name: 'paused', isActive: false });
    const recent = new Date(Date.now() - 60 * 1000);
    await prisma.jobSearch.update({ where: { id: fresh.id }, data: { lastRunAt: recent } });

    await tick();

    const byId = Object.fromEntries((await agent.get('/job-searches')).body.map((s) => [s.id, s]));
    expect(byId[due.id].lastRunAt).toBeTruthy();
    expect(new Date(byId[fresh.id].lastRunAt).getTime()).toBe(recent.getTime());
    expect(byId[paused.id].lastRunAt).toBeNull();
  });

  it('matches requires every query term in the title', () => {
    expect(matches({ title: 'Senior Backend Engineer' }, { query: 'backend engineer' })).toBe(true);
    expect(matches({ title: 'Backend Developer' }, { query: 'backend engineer' })).toBe(false);
  });
});
