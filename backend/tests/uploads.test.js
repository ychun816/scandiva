import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { app, makeUser } from './helpers.js';
import { uploadDir, resumesDir } from '../src/lib/uploads.js';

// Attachments (CV / cover letter on an application) are private documents. The
// resume-library path is covered in security.test.js; this file covers the
// generic /uploads/:filename attachment path, which has its own ownership rule.

const PDF = Buffer.from('%PDF-1.4 confidential');
const filenameOf = (url) => url.split('/').pop();

// Create a user with one application carrying an uploaded CV, and return the
// stored URL so tests can try to fetch it.
async function seedAttachment() {
  const { agent, cookie } = await makeUser();
  const created = await agent.post('/applications').send({ company: 'Acme', position: 'Eng' });
  const up = await request(app)
    .post(`/applications/${created.body.id}/upload`)
    .set('Cookie', cookie)
    .attach('cv', PDF, 'my-cv.pdf');
  return { agent, cookie, appId: created.body.id, cvUrl: up.body.cv, upload: up };
}

describe('POST /applications/:id/upload', () => {
  it('attaches a CV and records its URL on the application', async () => {
    const { upload } = await seedAttachment();
    expect(upload.status).toBe(200);
    expect(upload.body.cv).toMatch(/^\/uploads\//);
  });

  it('attaches a cover letter independently of the CV', async () => {
    const { agent, cookie, appId, cvUrl } = await seedAttachment();
    const up = await request(app)
      .post(`/applications/${appId}/upload`)
      .set('Cookie', cookie)
      .attach('coverLetter', Buffer.from('%PDF-1.4 letter'), 'letter.pdf');

    expect(up.status).toBe(200);
    expect(up.body.coverLetter).toMatch(/^\/uploads\//);
    // The previously attached CV survives an upload that only sends a cover letter.
    expect(up.body.cv).toBe(cvUrl);

    const list = await agent.get('/applications');
    expect(list.body[0].coverLetter).toBe(up.body.coverLetter);
  });

  it('gives every upload a unique stored filename (no overwrite by name)', async () => {
    const { cookie, appId, cvUrl } = await seedAttachment();
    const second = await request(app)
      .post(`/applications/${appId}/upload`)
      .set('Cookie', cookie)
      .attach('cv', Buffer.from('%PDF-1.4 v2'), 'my-cv.pdf'); // same original name

    expect(second.body.cv).not.toBe(cvUrl);
    expect(second.body.cv).toMatch(/^\/uploads\/\d+-\d+\.pdf$/); // timestamp-random.ext
  });

  it('requires authentication', async () => {
    const { appId } = await seedAttachment();
    const res = await request(app).post(`/applications/${appId}/upload`).attach('cv', PDF, 'x.pdf');
    expect(res.status).toBe(401);
  });

  it('cannot attach a file to someone else\'s application', async () => {
    const { appId } = await seedAttachment();
    const { cookie: mallory } = await makeUser();
    const res = await request(app)
      .post(`/applications/${appId}/upload`)
      .set('Cookie', mallory)
      .attach('cv', Buffer.from('%PDF-1.4 evil'), 'evil.pdf');

    // The update is scoped by userId, so it must not succeed.
    expect(res.status).not.toBe(200);
  });
});

describe('GET /uploads/:filename (attachment serving)', () => {
  it('serves the file to the owner', async () => {
    const { agent, cvUrl } = await seedAttachment();
    const res = await agent.get(cvUrl);
    expect(res.status).toBe(200);
    expect(res.body.toString()).toContain('%PDF-1.4');
  });

  it('returns 401 without a session', async () => {
    const { cvUrl } = await seedAttachment();
    expect((await request(app).get(cvUrl)).status).toBe(401);
  });

  it('returns 404 for a different user, even with the exact filename', async () => {
    const { cvUrl } = await seedAttachment();
    const { agent: mallory } = await makeUser();
    const res = await mallory.get(cvUrl);
    expect(res.status).toBe(404);
    // and definitely not the document itself
    expect(res.text || '').not.toContain('confidential');
  });

  it('stops serving a file once the owning application is deleted', async () => {
    const { agent, appId, cvUrl } = await seedAttachment();
    expect((await agent.get(cvUrl)).status).toBe(200);

    await agent.delete(`/applications/${appId}`);

    // Nothing references the file any more, so ownership can no longer be proven.
    expect((await agent.get(cvUrl)).status).toBe(404);
  });

  it('returns 404 for a filename that no row references', async () => {
    const { agent } = await makeUser();
    // Plant a real file on disk that belongs to nobody.
    const orphan = `orphan-${Date.now()}.pdf`;
    fs.writeFileSync(path.join(uploadDir, orphan), PDF);
    try {
      const res = await agent.get(`/uploads/${orphan}`);
      expect(res.status).toBe(404); // existence on disk is not authorization
    } finally {
      fs.rmSync(path.join(uploadDir, orphan), { force: true });
    }
  });

  it('does not let the attachment route reach into the resumes subfolder', async () => {
    const { agent } = await makeUser();
    // Upload a resume, then try to read it through the attachment ownership rule.
    const up = await agent.post('/resumes').field('name', 'CV').attach('file', PDF, 'cv.pdf');
    const name = filenameOf(up.body.filePath);
    expect(fs.existsSync(path.join(resumesDir, name))).toBe(true);

    // /uploads/resumes/<name> is the correct (owned) path and works...
    expect((await agent.get(`/uploads/resumes/${name}`)).status).toBe(200);
    // ...but the flat attachment route must not resolve it, since no application
    // references it as a cv/coverLetter.
    expect((await agent.get(`/uploads/${name}`)).status).toBe(404);
  });
});
