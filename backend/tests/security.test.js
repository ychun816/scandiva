import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app, makeUser, makeAdmin, tokenCookie } from './helpers.js';

// Every route that reads/writes user data must be behind auth.
const PROTECTED = [
  ['get', '/auth/me'],
  ['put', '/auth/profile'],
  ['get', '/auth/preferences'],
  ['put', '/auth/preferences'],
  ['put', '/auth/password'],
  ['get', '/auth/stats'],
  ['delete', '/auth/account'],
  ['get', '/applications'],
  ['post', '/applications'],
  ['put', '/applications/1'],
  ['delete', '/applications/1'],
  ['get', '/applications/1/stages'],
  ['post', '/applications/1/stages'],
  ['put', '/stages/1'],
  ['delete', '/stages/1'],
  ['get', '/resumes'],
  ['post', '/resumes'],
  ['get', '/resumes/1'],
  ['put', '/resumes/1'],
  ['delete', '/resumes/1'],
  ['get', '/letter-blocks'],
  ['post', '/letter-blocks'],
  ['put', '/letter-blocks/1'],
  ['delete', '/letter-blocks/1'],
  ['get', '/letter-versions'],
  ['post', '/letter-versions'],
  ['put', '/letter-versions/1'],
  ['delete', '/letter-versions/1'],
  ['get', '/ai/config'],
  ['put', '/ai/config'],
  ['post', '/ai/parse-job'],
  ['post', '/ai/generate-cell'],
  ['post', '/ai/summary'],
];

describe('authentication is required', () => {
  it.each(PROTECTED)('%s %s returns 401 without a cookie', async (method, url) => {
    const res = await request(app)[method](url).send({});
    expect(res.status).toBe(401);
  });
});

describe('JWT handling', () => {
  it('rejects a tampered/invalid token with 403', async () => {
    const res = await request(app).get('/auth/me').set('Cookie', ['token=not.a.valid.jwt']);
    expect(res.status).toBe(403);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const forged = jwt.sign({ id: 1, email: 'x@y.z' }, 'attacker-secret');
    const res = await request(app).get('/auth/me').set('Cookie', [`token=${forged}`]);
    expect(res.status).toBe(403);
  });
});

describe('cross-user isolation (IDOR)', () => {
  it('one user cannot read, update or delete another user\'s application', async () => {
    const { agent: alice } = await makeUser();
    const created = await alice.post('/applications').send({ company: 'Secret', position: 'Role' });
    const id = created.body.id;

    const { agent: bob } = await makeUser();
    // Bob's list never contains Alice's app
    const list = await bob.get('/applications');
    expect(list.body.find((a) => a.id === id)).toBeUndefined();
    // Bob cannot mutate it
    expect((await bob.put(`/applications/${id}`).send({ status: 'Rejected' })).status).toBe(404);
    expect((await bob.delete(`/applications/${id}`)).status).toBe(404);

    // Alice's application is untouched
    const stillThere = await alice.get('/applications');
    expect(stillThere.body[0].status).toBe('To Apply');
  });

  it('one user cannot touch another user\'s letter blocks', async () => {
    const { agent: alice } = await makeUser();
    const block = await alice.post('/letter-blocks').send({ title: 'Private', content: 'secret' });
    const { agent: bob } = await makeUser();
    expect((await bob.put(`/letter-blocks/${block.body.id}`).send({ content: 'hacked' })).status).toBe(404);
    expect((await bob.delete(`/letter-blocks/${block.body.id}`)).status).toBe(404);
  });
});

describe('admin authorization', () => {
  const ADMIN_ROUTES = ['/admin/stats', '/admin/users', '/admin/system', '/admin/logs'];

  it.each(ADMIN_ROUTES)('%s is 401 without a token', async (url) => {
    expect((await request(app).get(url)).status).toBe(401);
  });

  it.each(ADMIN_ROUTES)('%s is 403 for a non-admin user', async (url) => {
    const { cookie } = await makeUser();
    const res = await request(app).get(url).set('Cookie', cookie);
    expect(res.status).toBe(403);
  });

  it('an admin can access the admin routes', async () => {
    const { cookie } = await makeAdmin();
    for (const url of ADMIN_ROUTES) {
      const res = await request(app).get(url).set('Cookie', cookie);
      expect(res.status).toBe(200);
    }
  });

  it('GET /admin/check reflects admin status', async () => {
    const { agent: normal } = await makeUser();
    expect((await normal.get('/admin/check')).body.isAdmin).toBe(false);
    const { agent: admin } = await makeAdmin();
    expect((await admin.get('/admin/check')).body.isAdmin).toBe(true);
  });
});

describe('private file serving', () => {
  it('requires authentication to fetch an upload', async () => {
    expect((await request(app).get('/uploads/whatever.pdf')).status).toBe(401);
    expect((await request(app).get('/uploads/resumes/whatever.pdf')).status).toBe(401);
  });

  it('rejects ../ traversal even when authenticated', async () => {
    const { cookie } = await makeUser();
    const a = await request(app).get('/uploads/..%2f..%2f..%2fetc%2fpasswd').set('Cookie', cookie);
    const b = await request(app).get('/uploads/resumes/..%2f..%2fpackage.json').set('Cookie', cookie);
    expect(a.status).not.toBe(200);
    expect(b.status).not.toBe(200);
  });

  it('does not let a user download another user\'s resume file by filename', async () => {
    const { agent: alice } = await makeUser();
    const up = await alice.post('/resumes').field('name', 'Alice CV')
      .attach('file', Buffer.from('%PDF-1.4 alice'), 'cv.pdf');
    const filename = up.body.filePath.split('/').pop();

    // Owner can fetch it...
    const own = await alice.get(`/uploads/resumes/${filename}`);
    expect(own.status).toBe(200);

    // ...a different user cannot (404, not the file).
    const { agent: bob } = await makeUser();
    const foreign = await bob.get(`/uploads/resumes/${filename}`);
    expect(foreign.status).toBe(404);
  });
});

describe('malformed input handling', () => {
  it('invalid JSON body yields 400, not 500', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ this is not json');
    expect(res.status).toBe(400);
  });

  it('injection-looking strings are stored as literal data, not executed', async () => {
    const { agent } = await makeUser();
    const evil = "'; DROP TABLE users; --";
    const res = await agent.post('/applications').send({ company: evil, position: evil });
    expect(res.status).toBe(200);
    expect(res.body.company).toBe(evil);
    // The users table still works afterwards
    const me = await agent.get('/auth/me');
    expect(me.status).toBe(200);
  });
});

describe('rate limiting', () => {
  it('returns 429 after exceeding the auth limit', async () => {
    // Uses a fixed IP so the in-memory limiter buckets these together.
    const ip = '203.0.113.7';
    const max = Number(process.env.AUTH_RATE_LIMIT_MAX) || 1000;
    let sawLimit = false;
    for (let i = 0; i < max + 3; i++) {
      const res = await request(app)
        .post('/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email: 'nobody@example.com', password: 'x' });
      if (res.status === 429) { sawLimit = true; break; }
    }
    expect(sawLimit).toBe(true);
  });

  it('login cookie is httpOnly', async () => {
    const { cookie } = await makeUser();
    const tc = tokenCookie(cookie);
    expect(tc.toLowerCase()).toContain('httponly');
  });
});
