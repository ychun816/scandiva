import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeUser } from './helpers.js';

// The AI routes are the only place the backend calls out to a third party, and
// the only place it trusts a model's output. Every branch below stubs
// `global.fetch`, so nothing here touches a real provider: we are testing OUR
// validation, retry, and error mapping — not the LLM.

afterEach(() => {
  vi.restoreAllMocks();
  delete global.fetch;
});

// A user with AI configured. maxRetries controls how many extra attempts the
// route makes when the model returns something invalid.
async function configured(maxRetries = 1) {
  const { agent } = await makeUser();
  await agent.put('/ai/config').send({
    apiBase: 'https://api.example.com/v1',
    apiKey: 'test-key',
    model: 'gpt-4o-mini',
    maxRetries,
  });
  return agent;
}

const chatOk = (content) => ({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) });
const chatFail = (status, body = 'upstream boom') => ({ ok: false, status, text: async () => body });
const abortError = () => Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });

// A well-formed parse-job answer from the model.
const goodJob = {
  company: 'Acme',
  position: 'Backend Engineer',
  link: 'https://jobs.example.com/1',
  platform: 'LinkedIn',
  salary: '60k-70k',
  contractType: 'CDI',
  notes: 'Node + Postgres',
};

describe('POST /ai/parse-job (stubbed provider)', () => {
  it('returns the validated structured fields on a good response', async () => {
    const agent = await configured();
    global.fetch = vi.fn().mockResolvedValue(chatOk(JSON.stringify(goodJob)));

    const res = await agent.post('/ai/parse-job').send({ text: 'Acme is hiring a backend engineer, CDI, 60-70k' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      company: 'Acme',
      position: 'Backend Engineer',
      contractType: 'CDI',
      platform: 'LinkedIn',
    });
    // status is defaulted, never taken blindly from the model
    expect(res.body.status).toBe('To Apply');
  });

  it('strips markdown code fences the model wraps around the JSON', async () => {
    const agent = await configured();
    global.fetch = vi.fn().mockResolvedValue(chatOk('```json\n' + JSON.stringify(goodJob) + '\n```'));

    const res = await agent.post('/ai/parse-job').send({ text: 'a job posting at Acme' });
    expect(res.status).toBe(200);
    expect(res.body.company).toBe('Acme');
  });

  it('refuses an out-of-domain contractType invented by the model', async () => {
    const agent = await configured(0);
    // The model invents a contract type that is not in our vocabulary. With no
    // retries left the route must NOT hand it back — it reports a format error
    // instead of letting a value the UI cannot render reach the client.
    global.fetch = vi.fn().mockResolvedValue(chatOk(JSON.stringify({ ...goodJob, contractType: 'Slavery' })));

    const res = await agent.post('/ai/parse-job').send({ text: 'a job posting at Acme' });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/contractType/i);
  });

  it('never echoes an out-of-domain status back to the client', async () => {
    const agent = await configured();
    global.fetch = vi.fn().mockResolvedValue(chatOk(JSON.stringify({ ...goodJob, status: 'Hired-Immediately' })));

    const res = await agent.post('/ai/parse-job').send({ text: 'a job posting at Acme' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('To Apply');
  });

  it('truncates over-long model values to the documented field caps', async () => {
    const agent = await configured();
    global.fetch = vi.fn().mockResolvedValue(chatOk(JSON.stringify({
      ...goodJob,
      company: 'C'.repeat(500),   // cap 200
      link: 'L'.repeat(900),      // cap 500
      notes: 'N'.repeat(5000),    // cap 2000
    })));

    const res = await agent.post('/ai/parse-job').send({ text: 'a job posting at Acme' });
    expect(res.status).toBe(200);
    expect(res.body.company).toHaveLength(200);
    expect(res.body.link).toHaveLength(500);
    expect(res.body.notes).toHaveLength(2000);
  });

  it('retries after a malformed response and succeeds on the second attempt', async () => {
    const agent = await configured(1); // 1 retry => 2 attempts
    global.fetch = vi.fn()
      .mockResolvedValueOnce(chatOk('sorry, I cannot do that'))
      .mockResolvedValueOnce(chatOk(JSON.stringify(goodJob)));

    const res = await agent.post('/ai/parse-job').send({ text: 'a job posting at Acme' });
    expect(res.status).toBe(200);
    expect(res.body.company).toBe('Acme');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects a JSON array (not an object) from the model', async () => {
    const agent = await configured(0);
    global.fetch = vi.fn().mockResolvedValue(chatOk(JSON.stringify([goodJob])));

    const res = await agent.post('/ai/parse-job').send({ text: 'a job posting at Acme' });
    expect(res.status).toBe(502);
  });

  it('rejects a response missing required keys', async () => {
    const agent = await configured(0);
    global.fetch = vi.fn().mockResolvedValue(chatOk(JSON.stringify({ company: 'Acme' })));

    const res = await agent.post('/ai/parse-job').send({ text: 'a job posting at Acme' });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/missing required keys/i);
  });

  it('rejects non-string values for required keys', async () => {
    const agent = await configured(0);
    global.fetch = vi.fn().mockResolvedValue(chatOk(JSON.stringify({ ...goodJob, salary: 70000 })));

    const res = await agent.post('/ai/parse-job').send({ text: 'a job posting at Acme' });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/string values/i);
  });

  it('maps a provider 401/429/500 to 502 and does not leak the API key', async () => {
    const agent = await configured();
    for (const status of [401, 429, 500]) {
      global.fetch = vi.fn().mockResolvedValue(chatFail(status, 'invalid api key sk-secret'));
      const res = await agent.post('/ai/parse-job').send({ text: 'a job posting at Acme' });
      expect(res.status).toBe(502);
      expect(res.body.error).toContain(String(status));
      expect(JSON.stringify(res.body)).not.toContain('test-key');
    }
  });

  it('maps an aborted (timed-out) provider call to 504', async () => {
    const agent = await configured();
    global.fetch = vi.fn().mockRejectedValue(abortError());

    const res = await agent.post('/ai/parse-job').send({ text: 'a job posting at Acme' });
    expect(res.status).toBe(504);
    expect(res.body.error).toMatch(/timed out/i);
  });

  it('sends the model the configured base URL, model, and bearer key', async () => {
    const agent = await configured();
    global.fetch = vi.fn().mockResolvedValue(chatOk(JSON.stringify(goodJob)));
    await agent.post('/ai/parse-job').send({ text: 'a job posting at Acme' });

    const [url, init] = global.fetch.mock.calls[0];
    // The base is normalized to the OpenAI-compatible chat endpoint.
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    expect(JSON.parse(init.body).model).toBe('gpt-4o-mini');
  });

  it('caps the prompt it forwards, so a huge paste cannot blow up the request', async () => {
    const agent = await configured();
    global.fetch = vi.fn().mockResolvedValue(chatOk(JSON.stringify(goodJob)));
    await agent.post('/ai/parse-job').send({ text: 'x'.repeat(50000) });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    const userMsg = body.messages.find((m) => m.role === 'user');
    expect(userMsg.content.length).toBeLessThanOrEqual(6000);
  });
});

describe('POST /ai/generate-cell (stubbed provider)', () => {
  const cell = (content, title = 'Why this company') => chatOk(JSON.stringify({ title, content }));

  it('accepts content whose length sits inside the requested word bounds', async () => {
    const agent = await configured();
    const content = Array.from({ length: 50 }, (_, i) => `word${i}`).join(' ');
    global.fetch = vi.fn().mockResolvedValue(cell(content));

    const res = await agent.post('/ai/generate-cell')
      .send({ description: 'a paragraph about why I want this job', minWords: 40, maxWords: 60 });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Why this company');
  });

  it('rejects content far over the maximum, even after retrying', async () => {
    const agent = await configured(0); // single attempt
    const tooLong = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ');
    global.fetch = vi.fn().mockResolvedValue(cell(tooLong));

    const res = await agent.post('/ai/generate-cell')
      .send({ description: 'a short paragraph', maxWords: 30 });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/too long/i);
  });

  it('rejects content far under the minimum', async () => {
    const agent = await configured(0);
    global.fetch = vi.fn().mockResolvedValue(cell('Too short.'));

    const res = await agent.post('/ai/generate-cell')
      .send({ description: 'a long, detailed paragraph', minWords: 200 });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/too short/i);
  });

  it('feeds the measured length back into the retry prompt, then accepts a fixed answer', async () => {
    const agent = await configured(1);
    const tooLong = Array.from({ length: 120 }, (_, i) => `word${i}`).join(' ');
    const justRight = Array.from({ length: 28 }, (_, i) => `word${i}`).join(' ');
    global.fetch = vi.fn()
      .mockResolvedValueOnce(cell(tooLong))
      .mockResolvedValueOnce(cell(justRight));

    const res = await agent.post('/ai/generate-cell').send({ description: 'a short paragraph', maxWords: 30 });
    expect(res.status).toBe(200);

    // The correction turn must tell the model the real measured length.
    const retryBody = JSON.parse(global.fetch.mock.calls[1][1].body);
    const correction = retryBody.messages[retryBody.messages.length - 1];
    expect(correction.role).toBe('user');
    expect(correction.content).toMatch(/length is 120/);
  });

  it('counts Chinese characters as units, so a CJK paragraph is not wrongly rejected', async () => {
    const agent = await configured(0);
    // 60 Chinese characters. A naive space-delimited word count would see "1
    // word" and reject this as far under a 40-unit minimum.
    const chinese = '贵'.repeat(60);
    global.fetch = vi.fn().mockResolvedValue(cell(chinese, '为何选择贵公司'));

    const res = await agent.post('/ai/generate-cell')
      .send({ description: '写一段关于我为什么想加入贵公司的段落', minWords: 40, maxWords: 80 });
    expect(res.status).toBe(200);
    expect(res.body.content).toHaveLength(60);
  });

  it('rejects a CJK paragraph that genuinely exceeds the character limit', async () => {
    const agent = await configured(0);
    const chinese = '贵'.repeat(400);
    global.fetch = vi.fn().mockResolvedValue(cell(chinese, '为何选择贵公司'));

    const res = await agent.post('/ai/generate-cell')
      .send({ description: '写一段简短的段落', maxWords: 50 });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/too long/i);
  });

  it('rejects a response with an empty title or content', async () => {
    const agent = await configured(0);
    global.fetch = vi.fn().mockResolvedValue(chatOk(JSON.stringify({ title: '', content: 'x' })));
    const a = await agent.post('/ai/generate-cell').send({ description: 'why this job' });
    expect(a.status).toBe(502);

    global.fetch = vi.fn().mockResolvedValue(chatOk(JSON.stringify({ title: 'T', content: '   ' })));
    const b = await agent.post('/ai/generate-cell').send({ description: 'why this job' });
    expect(b.status).toBe(502);
  });

  it('maps an aborted provider call to 504', async () => {
    const agent = await configured();
    global.fetch = vi.fn().mockRejectedValue(abortError());
    const res = await agent.post('/ai/generate-cell').send({ description: 'why this job' });
    expect(res.status).toBe(504);
  });
});

describe('POST /ai/summary (stubbed provider)', () => {
  const board = [
    { company: 'Acme', position: 'Engineer', status: 'Applied', isStarred: true },
    { company: 'Globex', position: 'SRE', status: 'Interviewing' },
    { company: 'Initech', position: 'Dev', status: 'Applied' },
  ];

  it('returns the summary along with stage counts and the total in view', async () => {
    const agent = await configured();
    global.fetch = vi.fn().mockResolvedValue(chatOk('## Overview\nYour pipeline looks healthy.'));

    const res = await agent.post('/ai/summary').send({ applications: board });
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatch(/Overview/);
    expect(res.body.total).toBe(3);
    expect(res.body.counts).toEqual({ Applied: 2, Interviewing: 1 });
  });

  it('caps the board it forwards at 120 rows', async () => {
    const agent = await configured();
    global.fetch = vi.fn().mockResolvedValue(chatOk('## Overview\nok'));
    const many = Array.from({ length: 300 }, (_, i) => ({ company: `C${i}`, position: 'Dev', status: 'Applied' }));

    const res = await agent.post('/ai/summary').send({ applications: many });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(120);
  });

  it('does not forward fields the summary has no business seeing', async () => {
    const agent = await configured();
    global.fetch = vi.fn().mockResolvedValue(chatOk('## Overview\nok'));
    await agent.post('/ai/summary').send({
      applications: [{ company: 'Acme', position: 'Eng', status: 'Applied', cv: '/uploads/secret.pdf', userId: 42 }],
    });

    const sent = JSON.parse(global.fetch.mock.calls[0][1].body);
    const userContent = sent.messages.find((m) => m.role === 'user').content;
    expect(userContent).not.toContain('secret.pdf');
    expect(userContent).not.toContain('userId');
  });

  it('turns an empty model answer into a 502 rather than an empty summary', async () => {
    const agent = await configured();
    global.fetch = vi.fn().mockResolvedValue(chatOk('   '));

    const res = await agent.post('/ai/summary').send({ applications: board });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/empty/i);
  });

  it('maps a provider failure to 502 and an abort to 504', async () => {
    const agent = await configured();

    global.fetch = vi.fn().mockResolvedValue(chatFail(503));
    expect((await agent.post('/ai/summary').send({ applications: board })).status).toBe(502);

    global.fetch = vi.fn().mockRejectedValue(abortError());
    expect((await agent.post('/ai/summary').send({ applications: board })).status).toBe(504);
  });

  it('rejects a non-array applications payload', async () => {
    const agent = await configured();
    expect((await agent.post('/ai/summary').send({ applications: 'all of them' })).status).toBe(400);
    expect((await agent.post('/ai/summary').send({})).status).toBe(400);
  });
});

describe('AI provider config isolation', () => {
  it('one user\'s AI key is never used for another user\'s request', async () => {
    const alice = await configured();
    await alice.put('/ai/config').send({ apiBase: 'https://alice.example.com/v1', apiKey: 'alice-key', model: 'm' });

    // Bob has no AI config at all — his request must be refused, not silently
    // billed to Alice's provider account.
    const { agent: bob } = await makeUser();
    global.fetch = vi.fn().mockResolvedValue(chatOk(JSON.stringify(goodJob)));

    const res = await bob.post('/ai/parse-job').send({ text: 'a job posting at Acme' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not configured/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
