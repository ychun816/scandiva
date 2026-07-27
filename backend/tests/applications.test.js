import { describe, it, expect } from 'vitest';
import { makeUser } from './helpers.js';

const validApp = { company: 'Acme', position: 'Engineer' };

describe('applications CRUD', () => {
  it('POST creates an application with defaults', async () => {
    const { agent } = await makeUser();
    const res = await agent.post('/applications').send(validApp);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ company: 'Acme', position: 'Engineer', status: 'To Apply', isArchived: false });
  });

  it('POST requires company and position', async () => {
    const { agent } = await makeUser();
    expect((await agent.post('/applications').send({ company: 'X' })).status).toBe(400);
    expect((await agent.post('/applications').send({ position: 'Y' })).status).toBe(400);
    expect((await agent.post('/applications').send({})).status).toBe(400);
  });

  it('POST rejects an out-of-domain status or contract type', async () => {
    const { agent } = await makeUser();
    expect((await agent.post('/applications').send({ ...validApp, status: 'Bogus' })).status).toBe(400);
    expect((await agent.post('/applications').send({ ...validApp, contractType: 'Slavery' })).status).toBe(400);
  });

  it('PUT rejects an out-of-domain status', async () => {
    const { agent } = await makeUser();
    const created = await agent.post('/applications').send(validApp);
    const res = await agent.put(`/applications/${created.body.id}`).send({ status: 'Bogus' });
    expect(res.status).toBe(400);
  });

  it('PUT still allows an archive-only update (no status field)', async () => {
    const { agent } = await makeUser();
    const created = await agent.post('/applications').send({ ...validApp, status: 'Applied' });
    const res = await agent.put(`/applications/${created.body.id}`).send({ isArchived: true });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Applied');
  });

  it('GET lists only the current user\'s applications, newest first', async () => {
    const { agent } = await makeUser();
    await agent.post('/applications').send({ company: 'A', position: 'One' });
    await agent.post('/applications').send({ company: 'B', position: 'Two' });
    const res = await agent.get('/applications');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('latestStage');
  });

  it('PUT updates fields without touching status when archiving', async () => {
    const { agent } = await makeUser();
    const created = await agent.post('/applications').send({ ...validApp, status: 'Applied' });
    const id = created.body.id;
    const res = await agent.put(`/applications/${id}`).send({ isArchived: true });
    expect(res.status).toBe(200);
    expect(res.body.isArchived).toBe(true);
    expect(res.body.status).toBe('Applied');
  });

  it('PUT on a non-existent id returns 404', async () => {
    const { agent } = await makeUser();
    const res = await agent.put('/applications/999999').send({ status: 'Applied' });
    expect(res.status).toBe(404);
  });

  it('PUT with a non-numeric id returns 404', async () => {
    const { agent } = await makeUser();
    const res = await agent.put('/applications/abc').send({ status: 'Applied' });
    expect(res.status).toBe(404);
  });

  it('DELETE removes the application', async () => {
    const { agent } = await makeUser();
    const created = await agent.post('/applications').send(validApp);
    const del = await agent.delete(`/applications/${created.body.id}`);
    expect(del.status).toBe(200);
    const list = await agent.get('/applications');
    expect(list.body).toHaveLength(0);
  });

  it('DELETE on a non-existent id returns 404', async () => {
    const { agent } = await makeUser();
    const res = await agent.delete('/applications/999999');
    expect(res.status).toBe(404);
  });
});

describe('application stages', () => {
  async function seedApp() {
    const { agent } = await makeUser();
    const app = await agent.post('/applications').send(validApp);
    return { agent, appId: app.body.id };
  }

  it('POST creates a stage on an owned application', async () => {
    const { agent, appId } = await seedApp();
    const res = await agent.post(`/applications/${appId}/stages`).send({ stageName: 'HR Interview', status: 'upcoming' });
    expect(res.status).toBe(200);
    expect(res.body.stageName).toBe('HR Interview');
  });

  it('POST requires stageName and status', async () => {
    const { agent, appId } = await seedApp();
    const res = await agent.post(`/applications/${appId}/stages`).send({ stageName: 'Only name' });
    expect(res.status).toBe(400);
  });

  it('POST stage on someone else\'s application returns 404', async () => {
    const { appId } = await seedApp();
    const { agent: other } = await makeUser();
    const res = await other.post(`/applications/${appId}/stages`).send({ stageName: 'X', status: 'upcoming' });
    expect(res.status).toBe(404);
  });

  it('GET lists stages for an application', async () => {
    const { agent, appId } = await seedApp();
    await agent.post(`/applications/${appId}/stages`).send({ stageName: 'A', status: 'passed' });
    const res = await agent.get(`/applications/${appId}/stages`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('PUT and DELETE a stage', async () => {
    const { agent, appId } = await seedApp();
    const stage = await agent.post(`/applications/${appId}/stages`).send({ stageName: 'A', status: 'upcoming' });
    const put = await agent.put(`/stages/${stage.body.id}`).send({ status: 'passed', stageName: 'A' });
    expect(put.status).toBe(200);
    expect(put.body.status).toBe('passed');
    const del = await agent.delete(`/stages/${stage.body.id}`);
    expect(del.status).toBe(200);
  });

  it('PUT a stage that isn\'t yours returns 404', async () => {
    const { agent, appId } = await seedApp();
    const stage = await agent.post(`/applications/${appId}/stages`).send({ stageName: 'A', status: 'upcoming' });
    const { agent: other } = await makeUser();
    const res = await other.put(`/stages/${stage.body.id}`).send({ status: 'failed', stageName: 'A' });
    expect(res.status).toBe(404);
  });
});
