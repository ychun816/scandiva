import { describe, it, expect } from 'vitest';
import { makeUser } from './helpers.js';

const PDF = Buffer.from('%PDF-1.4 fake resume');

describe('resumes', () => {
  it('POST requires both a file and a name', async () => {
    const { agent } = await makeUser();
    const noFile = await agent.post('/resumes').field('name', 'CV');
    expect(noFile.status).toBe(400);
  });

  it('uploads, lists, fetches, renames and deletes a resume', async () => {
    const { agent } = await makeUser();
    const up = await agent.post('/resumes').field('name', 'My CV').attach('file', PDF, 'cv.pdf');
    expect(up.status).toBe(200);
    expect(up.body.name).toBe('My CV');
    const id = up.body.id;

    const list = await agent.get('/resumes');
    expect(list.body).toHaveLength(1);

    const detail = await agent.get(`/resumes/${id}`);
    expect(detail.body.id).toBe(id);
    expect(detail.body.applications).toEqual([]);

    const rename = await agent.put(`/resumes/${id}`).send({ name: 'Renamed CV' });
    expect(rename.body.name).toBe('Renamed CV');

    const download = await agent.get(`/resumes/${id}/download`);
    expect(download.status).toBe(200);

    const del = await agent.delete(`/resumes/${id}`);
    expect(del.status).toBe(200);
  });

  it('rejects a disallowed file type', async () => {
    const { agent } = await makeUser();
    const res = await agent.post('/resumes').field('name', 'Bad').attach('file', Buffer.from('x'), 'evil.exe');
    expect(res.status).toBe(400);
  });

  it('GET a resume that isn\'t yours returns 404', async () => {
    const { agent } = await makeUser();
    const up = await agent.post('/resumes').field('name', 'Mine').attach('file', PDF, 'cv.pdf');
    const { agent: other } = await makeUser();
    const res = await other.get(`/resumes/${up.body.id}`);
    expect(res.status).toBe(404);
  });

  it('links a resume to an application (only if both are owned)', async () => {
    const { agent } = await makeUser();
    const app = await agent.post('/applications').send({ company: 'A', position: 'B' });
    const resume = await agent.post('/resumes').field('name', 'CV').attach('file', PDF, 'cv.pdf');
    const link = await agent.put(`/applications/${app.body.id}/resume`).send({ resumeId: resume.body.id });
    expect(link.status).toBe(200);
    expect(link.body.resumeId).toBe(resume.body.id);

    // unlink
    const unlink = await agent.put(`/applications/${app.body.id}/resume`).send({ resumeId: null });
    expect(unlink.body.resumeId).toBeNull();
  });

  it('refuses to link a resume owned by another user', async () => {
    const { agent } = await makeUser();
    const app = await agent.post('/applications').send({ company: 'A', position: 'B' });
    const { agent: other } = await makeUser();
    const foreignResume = await other.post('/resumes').field('name', 'CV').attach('file', PDF, 'cv.pdf');
    const link = await agent.put(`/applications/${app.body.id}/resume`).send({ resumeId: foreignResume.body.id });
    expect(link.status).toBe(404);
  });
});
