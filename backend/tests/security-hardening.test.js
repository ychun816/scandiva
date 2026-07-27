import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app, makeUser, makeAdmin, strongPassword, tokenCookie } from './helpers.js';

// Security tests that go beyond the basic "is it behind auth" checks in
// security.test.js: token lifecycle, session invalidation, injection payloads
// that survive a round trip, request-size limits, and admin-surface abuse.

const SECRET = process.env.JWT_SECRET;
const randomIp = () => `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.9`;

describe('JWT lifecycle', () => {
  it('rejects an expired token with 403', async () => {
    const { user } = await makeUser();
    const expired = jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: '-1h' });
    const res = await request(app).get('/auth/me').set('Cookie', [`token=${expired}`]);
    expect(res.status).toBe(403);
  });

  it('rejects a token signed with "none" (algorithm confusion)', async () => {
    const { user } = await makeUser();
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ id: user.id, email: user.email })).toString('base64url');
    const res = await request(app).get('/auth/me').set('Cookie', [`token=${header}.${payload}.`]);
    expect(res.status).toBe(403);
  });

  it('a token whose payload claims isAdmin does not grant admin access', async () => {
    // Admin-ness is read from the database, never from the token body.
    const { user } = await makeUser();
    const forged = jwt.sign({ id: user.id, email: user.email, isAdmin: true }, SECRET, { expiresIn: '24h' });
    const res = await request(app).get('/admin/users').set('Cookie', [`token=${forged}`]);
    expect(res.status).toBe(403);
  });

  it('a valid token for a deleted user cannot read or write data', async () => {
    const { agent } = await makeUser();
    await agent.post('/applications').send({ company: 'Acme', position: 'Eng' });
    await agent.delete('/auth/account');

    // The JWT still verifies — the user row does not exist any more.
    expect((await agent.get('/auth/me')).status).toBe(404);
    // Reads scope to a userId that owns nothing.
    const list = await agent.get('/applications');
    expect(list.body).toEqual([]);
    // Writes must not resurrect data under a dangling user id.
    const create = await agent.post('/applications').send({ company: 'Ghost', position: 'Zombie' });
    expect(create.status).toBeGreaterThanOrEqual(400);
  });

  it('the session cookie is httpOnly and sameSite-scoped', async () => {
    const { cookie } = await makeUser();
    const tc = tokenCookie(cookie).toLowerCase();
    expect(tc).toContain('httponly');
    expect(tc).toContain('samesite');
  });
});

describe('injection and untrusted-content handling', () => {
  it('stores an XSS payload verbatim and never reflects it as HTML', async () => {
    const { agent } = await makeUser();
    const xss = '<script>alert(document.cookie)</script>';
    const created = await agent.post('/applications').send({ company: xss, position: 'Eng', notes: xss });
    expect(created.status).toBe(200);
    // Round-trips as data, and the response is JSON — not an HTML document.
    expect(created.body.company).toBe(xss);
    expect(created.headers['content-type']).toMatch(/application\/json/);

    const list = await agent.get('/applications');
    expect(list.body[0].notes).toBe(xss);
  });

  it('treats SQL metacharacters in a login email as literal data', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('X-Forwarded-For', randomIp())
      .send({ email: "' OR 1=1 --", password: 'anything' });
    // No user matches; the query must not become a tautology.
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('a __proto__ key in the body does not pollute Object.prototype', async () => {
    const { cookie } = await makeUser();
    await request(app)
      .post('/applications')
      .set('Cookie', cookie)
      .set('Content-Type', 'application/json')
      .send('{"company":"Acme","position":"Eng","__proto__":{"polluted":"yes"}}');

    expect({}.polluted).toBeUndefined();
    expect(Object.prototype.polluted).toBeUndefined();
  });

  it('a constructor.prototype payload does not pollute Object.prototype', async () => {
    const { cookie } = await makeUser();
    await request(app)
      .post('/letter-blocks')
      .set('Cookie', cookie)
      .set('Content-Type', 'application/json')
      .send('{"title":"T","constructor":{"prototype":{"pwned":true}}}');

    expect({}.pwned).toBeUndefined();
  });

  it('a null byte in a filename cannot escape the upload root', async () => {
    const { cookie } = await makeUser();
    const res = await request(app)
      .get('/uploads/resumes/%00../../../etc/passwd')
      .set('Cookie', cookie);
    expect(res.status).not.toBe(200);
  });
});

describe('request size and shape limits', () => {
  it('rejects a body over the JSON size limit with 413, not 500', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('X-Forwarded-For', randomIp())
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(200 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/too large/i);
  });

  it('an unknown route returns 404, never a stack trace', async () => {
    const res = await request(app).get('/definitely/not/a/route');
    expect(res.status).toBe(404);
    expect(res.text || '').not.toMatch(/at .*\(.*:\d+:\d+\)/); // no stack frames
  });

  it('a non-numeric or negative :id is a clean 404, not a 500', async () => {
    const { agent } = await makeUser();
    for (const id of ['abc', '-1', '0', '1.5', 'NaN', '1e10000']) {
      const res = await agent.put(`/applications/${id}`).send({ status: 'Applied' });
      expect([400, 404]).toContain(res.status);
    }
  });
});

describe('secret exposure', () => {
  it('GET /ai/config never returns the stored API key', async () => {
    const { agent } = await makeUser();
    await agent.put('/ai/config').send({ apiBase: 'https://api.example.com/v1', apiKey: 'sk-super-secret', model: 'm' });
    const res = await agent.get('/ai/config');
    expect(JSON.stringify(res.body)).not.toContain('sk-super-secret');
    expect(res.body.hasKey).toBe(true);
  });

  it('no auth response body contains a password or password hash', async () => {
    const { agent, user } = await makeUser();
    const bodies = [
      user,
      (await agent.get('/auth/me')).body,
      (await agent.put('/auth/profile').send({ name: 'X' })).body,
    ];
    for (const body of bodies) {
      expect(body).not.toHaveProperty('password');
      expect(JSON.stringify(body)).not.toContain('$2a$'); // bcrypt hash prefix
      expect(JSON.stringify(body)).not.toContain(strongPassword);
    }
  });

  it('the admin user list does not expose password hashes or AI keys', async () => {
    const { cookie } = await makeAdmin();
    const res = await request(app).get('/admin/users').set('Cookie', cookie);
    expect(res.status).toBe(200);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('$2a$');
    expect(raw).not.toMatch(/aiApiKey/);
  });
});

describe('admin surface', () => {
  it('admin reads are recorded in the audit log', async () => {
    const { cookie } = await makeAdmin();
    await request(app).get('/admin/users').set('Cookie', cookie);
    const logs = await request(app).get('/admin/logs').set('Cookie', cookie);
    expect(logs.status).toBe(200);
    expect(logs.body.some((l) => l.action === 'view_users')).toBe(true);
  });

  it('a non-admin cannot promote themselves through any exposed route', async () => {
    const { agent } = await makeUser();
    // No route accepts isAdmin; passing it must be ignored, not honored.
    await agent.put('/auth/profile').send({ name: 'X', isAdmin: true });
    expect((await agent.get('/admin/check')).body.isAdmin).toBe(false);
    expect((await agent.get('/admin/users')).status).toBe(403);
  });
});
