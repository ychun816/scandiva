import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { app, makeUser, strongPassword } from './helpers.js';
import { resumesDir } from '../src/lib/uploads.js';

// Account deletion is the one operation that must leave nothing behind: it is
// both a GDPR-style promise to the user and the riskiest multi-table write in
// the app. These tests seed every user-owned table, delete, and then assert
// directly against the database that no row survives.

const prisma = new PrismaClient();

beforeAll(async () => { await prisma.$connect(); });
afterAll(async () => { await prisma.$disconnect(); });

const PDF = Buffer.from('%PDF-1.4 resume');

// Populate every table that hangs off a user.
async function seedFullAccount() {
  const { agent, cookie, user, email } = await makeUser();

  const application = (await agent.post('/applications')
    .send({ company: 'Acme', position: 'Engineer', status: 'Applied' })).body;

  const stage = (await agent.post(`/applications/${application.id}/stages`)
    .send({ stageName: 'HR Interview', status: 'passed' })).body;

  const resume = (await agent.post('/resumes')
    .field('name', 'My CV')
    .attach('file', PDF, 'cv.pdf')).body;

  const folder = (await agent.post('/letter-folders').send({ name: 'Intros' })).body;
  const block = (await agent.post('/letter-blocks')
    .send({ title: 'Opening', content: 'Dear team', folderId: folder.id })).body;
  const version = (await agent.post('/letter-versions')
    .send({ name: 'V1', blockIds: [block.id] })).body;

  await agent.put('/ai/config').send({ apiBase: 'https://api.example.com/v1', apiKey: 'k', model: 'm' });
  await request(app).post(`/applications/${application.id}/upload`)
    .set('Cookie', cookie)
    .attach('cv', PDF, 'attached-cv.pdf');

  return { agent, user, email, application, stage, resume, folder, block, version };
}

describe('DELETE /auth/account', () => {
  it('removes every row the user owned, across all tables', async () => {
    const { agent, user } = await seedFullAccount();

    // Everything is really there before we delete.
    expect(await prisma.application.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.resume.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.letterFolder.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.letterBlock.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.letterVersion.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.applicationStage.count({ where: { application: { userId: user.id } } })).toBe(1);

    const res = await agent.delete('/auth/account');
    expect(res.status).toBe(200);

    // ...and nothing survives.
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await prisma.application.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.resume.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.letterFolder.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.letterBlock.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.letterVersion.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.applicationStage.count({ where: { application: { userId: user.id } } })).toBe(0);
  });

  it('deletes the stored resume file from disk', async () => {
    const { agent, resume } = await seedFullAccount();
    const stored = path.join(resumesDir, resume.filePath.split('/').pop());
    expect(fs.existsSync(stored)).toBe(true);

    await agent.delete('/auth/account');
    expect(fs.existsSync(stored)).toBe(false);
  });

  it('clears the session cookie and frees the email for re-registration', async () => {
    const { agent, email } = await seedFullAccount();
    const del = await agent.delete('/auth/account');
    expect(del.headers['set-cookie'][0]).toMatch(/token=;/);

    // The unique-email constraint must no longer hold the address hostage.
    const again = await request(app)
      .post('/auth/register')
      .set('X-Forwarded-For', '10.44.44.44')
      .send({ email, password: strongPassword, name: 'Reborn' });
    expect(again.status).toBe(200);

    // The reborn account starts empty — no data leaks across the id boundary.
    const fresh = await request(app).get('/applications').set('Cookie', again.headers['set-cookie']);
    expect(fresh.body).toEqual([]);
  });

  it('leaves other users\' data completely untouched', async () => {
    const { agent: victim, user: victimUser } = await seedFullAccount();
    const { agent: bystander, user: bystanderUser } = await seedFullAccount();

    await victim.delete('/auth/account');

    expect(await prisma.user.findUnique({ where: { id: victimUser.id } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: bystanderUser.id } })).not.toBeNull();
    expect(await prisma.application.count({ where: { userId: bystanderUser.id } })).toBe(1);
    expect(await prisma.letterBlock.count({ where: { userId: bystanderUser.id } })).toBe(1);

    // The bystander can still use the app normally.
    expect((await bystander.get('/applications')).body).toHaveLength(1);
    expect((await bystander.get('/letter-blocks')).body).toHaveLength(1);
  });
});

describe('password change invalidates nothing it should not', () => {
  it('the old password stops working and the new one works', async () => {
    const { agent, email } = await makeUser();
    await agent.put('/auth/password').send({ oldPassword: strongPassword, newPassword: 'Rotated123!' });

    const oldLogin = await request(app).post('/auth/login')
      .set('X-Forwarded-For', '10.55.55.55')
      .send({ email, password: strongPassword });
    expect(oldLogin.status).toBe(400);

    const newLogin = await request(app).post('/auth/login')
      .set('X-Forwarded-For', '10.55.55.56')
      .send({ email, password: 'Rotated123!' });
    expect(newLogin.status).toBe(200);
  });

  it('a password change does not destroy the user\'s data', async () => {
    const { agent } = await makeUser();
    await agent.post('/applications').send({ company: 'Acme', position: 'Eng' });
    await agent.put('/auth/password').send({ oldPassword: strongPassword, newPassword: 'Rotated123!' });
    expect((await agent.get('/applications')).body).toHaveLength(1);
  });
});
