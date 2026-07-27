import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { app, makeUser, strongPassword } from './helpers.js';

const uniqueEmail = () => `auth_${randomUUID()}@example.com`;

describe('POST /auth/register', () => {
  it('creates a user, sets an httpOnly cookie, never returns the password', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: uniqueEmail(), password: strongPassword, name: 'Alice' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Alice' });
    expect(res.body.password).toBeUndefined();
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/token=/);
    expect(cookie.toLowerCase()).toContain('httponly');
  });

  it('rejects a missing email or password', async () => {
    const a = await request(app).post('/auth/register').send({ password: strongPassword });
    const b = await request(app).post('/auth/register').send({ email: uniqueEmail() });
    expect(a.status).toBe(400);
    expect(b.status).toBe(400);
  });

  it('rejects a weak password', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: uniqueEmail(), password: 'weak' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/i);
  });

  it('rejects an invalid email format', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'not-an-email', password: strongPassword });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it('rejects a duplicate email', async () => {
    const email = uniqueEmail();
    await request(app).post('/auth/register').send({ email, password: strongPassword });
    const res = await request(app).post('/auth/register').send({ email, password: strongPassword });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already registered/i);
  });
});

describe('POST /auth/login', () => {
  it('logs in with correct credentials', async () => {
    const email = uniqueEmail();
    await request(app).post('/auth/register').send({ email, password: strongPassword });
    const res = await request(app).post('/auth/login').send({ email, password: strongPassword });
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/token=/);
  });

  it('returns a generic error for a wrong password (no user enumeration)', async () => {
    const email = uniqueEmail();
    await request(app).post('/auth/register').send({ email, password: strongPassword });
    const res = await request(app).post('/auth/login').send({ email, password: 'Wrong1234!' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('returns the same generic error for an unknown user', async () => {
    const res = await request(app).post('/auth/login').send({ email: uniqueEmail(), password: strongPassword });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('requires email and password', async () => {
    const res = await request(app).post('/auth/login').send({});
    expect(res.status).toBe(400);
  });
});

describe('auth session routes', () => {
  it('GET /auth/me returns the current user', async () => {
    const { agent, user } = await makeUser();
    const res = await agent.get('/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(user.email);
  });

  it('PUT /auth/profile updates the name', async () => {
    const { agent } = await makeUser();
    const res = await agent.put('/auth/profile').send({ name: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed');
  });

  it('GET+PUT /auth/preferences round-trips notification flags', async () => {
    const { agent } = await makeUser();
    const put = await agent.put('/auth/preferences').send({ notifyEmail: false, notifyReminders: true, notifyDigest: true });
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({ notifyEmail: false, notifyDigest: true });
    const get = await agent.get('/auth/preferences');
    expect(get.body.notifyEmail).toBe(false);
  });

  it('POST /auth/logout clears the cookie', async () => {
    const { agent } = await makeUser();
    const res = await agent.post('/auth/logout');
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/token=;/);
  });
});

describe('PUT /auth/password', () => {
  it('changes the password when the old one is correct', async () => {
    const { agent, email } = await makeUser();
    const res = await agent.put('/auth/password').send({ oldPassword: strongPassword, newPassword: 'NewPass123!' });
    expect(res.status).toBe(200);
    const login = await request(app).post('/auth/login').send({ email, password: 'NewPass123!' });
    expect(login.status).toBe(200);
  });

  it('rejects a wrong current password', async () => {
    const { agent } = await makeUser();
    const res = await agent.put('/auth/password').send({ oldPassword: 'Wrong1234!', newPassword: 'NewPass123!' });
    expect(res.status).toBe(400);
  });

  it('rejects a weak new password', async () => {
    const { agent } = await makeUser();
    const res = await agent.put('/auth/password').send({ oldPassword: strongPassword, newPassword: 'weak' });
    expect(res.status).toBe(400);
  });
});

describe('GET /auth/stats', () => {
  it('returns zeroed counts for a new user', async () => {
    const { agent } = await makeUser();
    const res = await agent.get('/auth/stats');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 0, applied: 0 });
  });

  it('counts archived applications via the isArchived flag, not a status', async () => {
    const { agent } = await makeUser();
    const created = await agent.post('/applications').send({ company: 'A', position: 'B', status: 'Applied' });
    await agent.put(`/applications/${created.body.id}`).send({ isArchived: true });
    const res = await agent.get('/auth/stats');
    expect(res.body.archived).toBe(1);
    // The archived app keeps its real status, so it's still counted there too.
    expect(res.body.applied).toBe(1);
  });
});

describe('DELETE /auth/account', () => {
  it('deletes the account and invalidates the session', async () => {
    const { agent } = await makeUser();
    const del = await agent.delete('/auth/account');
    expect(del.status).toBe(200);
    const me = await agent.get('/auth/me');
    // token still verifies (JWT), but the user row is gone → 404
    expect(me.status).toBe(404);
  });
});
