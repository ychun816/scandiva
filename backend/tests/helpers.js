import request from 'supertest';
import { randomUUID } from 'node:crypto';
import app from '../src/app.js';

export { app };

export const strongPassword = 'Test1234!';

// A random client IP per user so the shared in-memory rate-limiter buckets
// don't accumulate across the whole suite (trust proxy is on).
const randomIp = () =>
  `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 254) + 1}`;

// Register a brand-new user and return { agent, cookie, user }.
// `agent` is a supertest agent that carries the auth cookie automatically.
export async function makeUser(overrides = {}) {
  const email = overrides.email || `user_${randomUUID()}@example.com`;
  const password = overrides.password || strongPassword;
  const res = await request(app)
    .post('/auth/register')
    .set('X-Forwarded-For', randomIp())
    .send({ email, password, name: overrides.name || 'Test User' });
  if (res.status !== 200) {
    throw new Error(`makeUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const cookie = res.headers['set-cookie'];
  const agent = authed(cookie);
  return { agent, cookie, user: res.body, email, password };
}

// A supertest wrapper that attaches the given auth cookie to every request.
export function authed(cookie) {
  const wrap = (method) => (url) => request(app)[method](url).set('Cookie', cookie);
  return {
    get: wrap('get'),
    post: wrap('post'),
    put: wrap('put'),
    delete: wrap('delete'),
  };
}

// Promote a user to admin directly in the DB (no API exists for this by design).
export async function makeAdmin() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const { agent, cookie, user, email, password } = await makeUser();
  await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
  await prisma.$disconnect();
  return { agent, cookie, user, email, password };
}

// Extract the token cookie string (for tampering / flag assertions).
export function tokenCookie(setCookie) {
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  return arr.find((c) => c.startsWith('token='));
}
