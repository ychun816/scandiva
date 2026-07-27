import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeUser } from './helpers.js';

// These tests cover the config surface and the guard rails around AI routes
// without hitting a real LLM. Where a route calls out, we stub global.fetch.

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AI config', () => {
  it('reports no key for a fresh user and never leaks the key', async () => {
    const { agent } = await makeUser();
    const res = await agent.get('/ai/config');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ hasKey: false, maxRetries: 2 });
    expect(res.body).not.toHaveProperty('apiKey');
    expect(res.body).not.toHaveProperty('aiApiKey');
  });

  it('saves config, clamps maxRetries, and hides the key on read', async () => {
    const { agent } = await makeUser();
    const put = await agent.put('/ai/config').send({ apiBase: 'https://api.example.com/v1', apiKey: 'secret-key', model: 'gpt-4o-mini', maxRetries: 99 });
    expect(put.status).toBe(200);
    expect(put.body.hasKey).toBe(true);
    expect(put.body.maxRetries).toBe(5); // clamped 0..5
    const get = await agent.get('/ai/config');
    expect(get.body.hasKey).toBe(true);
    expect(get.body.apiBase).toBe('https://api.example.com/v1');
  });

  it('an empty apiKey leaves the stored key untouched', async () => {
    const { agent } = await makeUser();
    await agent.put('/ai/config').send({ apiBase: 'https://a.com', apiKey: 'keep-me', model: 'm' });
    const put = await agent.put('/ai/config').send({ apiBase: 'https://b.com', apiKey: '', model: 'm2' });
    expect(put.body.hasKey).toBe(true);
    expect(put.body.apiBase).toBe('https://b.com');
  });

  it('DELETE clears the config', async () => {
    const { agent } = await makeUser();
    await agent.put('/ai/config').send({ apiBase: 'https://a.com', apiKey: 'k', model: 'm' });
    const del = await agent.delete('/ai/config');
    expect(del.body.hasKey).toBe(false);
  });
});

describe('AI routes require configuration', () => {
  it('parse-job is 400 when AI is not configured', async () => {
    const { agent } = await makeUser();
    const res = await agent.post('/ai/parse-job').send({ text: 'Some job at Acme' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not configured/i);
  });

  it('generate-cell is 400 when AI is not configured', async () => {
    const { agent } = await makeUser();
    const res = await agent.post('/ai/generate-cell').send({ description: 'a strong intro paragraph' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not configured/i);
  });

  it('parse-job validates the input length', async () => {
    const { agent } = await makeUser();
    const res = await agent.post('/ai/parse-job').send({ text: 'x' });
    expect(res.status).toBe(400);
  });

  it('generate-cell validates the description', async () => {
    const { agent } = await makeUser();
    const res = await agent.post('/ai/generate-cell').send({ description: '' });
    expect(res.status).toBe(400);
  });

  it('summary requires a non-empty applications array', async () => {
    const { agent } = await makeUser();
    const res = await agent.post('/ai/summary').send({ applications: [] });
    expect(res.status).toBe(400);
  });
});

describe('AI generate-cell with a stubbed provider', () => {
  async function configured() {
    const { agent } = await makeUser();
    await agent.put('/ai/config').send({ apiBase: 'https://api.example.com/v1', apiKey: 'k', model: 'gpt-4o-mini', maxRetries: 1 });
    return agent;
  }

  const mockChat = (content) => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content } }] }),
    });
  };

  it('returns a validated {title, content} from a good response', async () => {
    const agent = await configured();
    mockChat(JSON.stringify({ title: 'Why us', content: 'A thoughtful paragraph about the company.' }));
    const res = await agent.post('/ai/generate-cell').send({ description: 'why I want this job' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'Why us' });
  });

  it('surfaces a provider error as 502', async () => {
    const agent = await configured();
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });
    const res = await agent.post('/ai/generate-cell').send({ description: 'why I want this job' });
    expect(res.status).toBe(502);
  });

  it('gives up with 502 when the model never returns valid JSON', async () => {
    const agent = await configured();
    mockChat('this is not json at all');
    const res = await agent.post('/ai/generate-cell').send({ description: 'why I want this job' });
    expect(res.status).toBe(502);
  });
});
