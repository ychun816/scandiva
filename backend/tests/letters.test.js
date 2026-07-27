import { describe, it, expect } from 'vitest';
import { makeUser } from './helpers.js';

describe('letter blocks', () => {
  it('POST requires a title', async () => {
    const { agent } = await makeUser();
    const res = await agent.post('/letter-blocks').send({ content: 'no title' });
    expect(res.status).toBe(400);
  });

  it('CRUD lifecycle', async () => {
    const { agent } = await makeUser();
    const created = await agent.post('/letter-blocks').send({ title: 'Intro', content: 'Hello' });
    expect(created.status).toBe(200);
    const id = created.body.id;

    const list = await agent.get('/letter-blocks');
    expect(list.body).toHaveLength(1);

    const updated = await agent.put(`/letter-blocks/${id}`).send({ content: 'Updated' });
    expect(updated.body.content).toBe('Updated');
    expect(updated.body.title).toBe('Intro');

    const del = await agent.delete(`/letter-blocks/${id}`);
    expect(del.status).toBe(200);
    expect((await agent.get('/letter-blocks')).body).toHaveLength(0);
  });

  it('deleting a block unplugs it from every version', async () => {
    const { agent } = await makeUser();
    const b1 = (await agent.post('/letter-blocks').send({ title: 'A', content: 'a' })).body;
    const b2 = (await agent.post('/letter-blocks').send({ title: 'B', content: 'b' })).body;
    const v = (await agent.post('/letter-versions').send({ name: 'V1', blockIds: [b1.id, b2.id] })).body;
    expect(v.blockIds).toEqual([b1.id, b2.id]);

    await agent.delete(`/letter-blocks/${b1.id}`);
    const versions = await agent.get('/letter-versions');
    expect(versions.body[0].blockIds).toEqual([b2.id]);
  });
});

describe('letter folders', () => {
  it('POST requires a name', async () => {
    const { agent } = await makeUser();
    expect((await agent.post('/letter-folders').send({})).status).toBe(400);
  });

  it('CRUD lifecycle', async () => {
    const { agent } = await makeUser();
    const created = await agent.post('/letter-folders').send({ name: 'Intros' });
    expect(created.status).toBe(200);
    const id = created.body.id;
    expect((await agent.get('/letter-folders')).body).toHaveLength(1);
    const renamed = await agent.put(`/letter-folders/${id}`).send({ name: 'Openings' });
    expect(renamed.body.name).toBe('Openings');
    expect((await agent.delete(`/letter-folders/${id}`)).status).toBe(200);
    expect((await agent.get('/letter-folders')).body).toHaveLength(0);
  });

  it('creates a cell inside a folder and moves it between folders and root', async () => {
    const { agent } = await makeUser();
    const f1 = (await agent.post('/letter-folders').send({ name: 'A' })).body;
    const f2 = (await agent.post('/letter-folders').send({ name: 'B' })).body;

    const block = (await agent.post('/letter-blocks').send({ title: 'X', content: 'x', folderId: f1.id })).body;
    expect(block.folderId).toBe(f1.id);

    const moved = await agent.put(`/letter-blocks/${block.id}`).send({ folderId: f2.id });
    expect(moved.body.folderId).toBe(f2.id);

    const toRoot = await agent.put(`/letter-blocks/${block.id}`).send({ folderId: null });
    expect(toRoot.body.folderId).toBeNull();
  });

  it('reorders folders and persists the new order', async () => {
    const { agent } = await makeUser();
    const a = (await agent.post('/letter-folders').send({ name: 'A' })).body;
    const b = (await agent.post('/letter-folders').send({ name: 'B' })).body;
    const c = (await agent.post('/letter-folders').send({ name: 'C' })).body;
    // initial order A, B, C
    expect((await agent.get('/letter-folders')).body.map(f => f.name)).toEqual(['A', 'B', 'C']);

    const res = await agent.put('/letter-folders/reorder').send({ ids: [c.id, a.id, b.id] });
    expect(res.status).toBe(200);
    expect(res.body.map(f => f.name)).toEqual(['C', 'A', 'B']);
    // survives a fresh fetch
    expect((await agent.get('/letter-folders')).body.map(f => f.name)).toEqual(['C', 'A', 'B']);
  });

  it('reorder ignores folder ids the user does not own', async () => {
    const { agent } = await makeUser();
    const mine = (await agent.post('/letter-folders').send({ name: 'Mine' })).body;
    const { agent: other } = await makeUser();
    const theirs = (await other.post('/letter-folders').send({ name: 'Theirs' })).body;
    const res = await agent.put('/letter-folders/reorder').send({ ids: [theirs.id, mine.id] });
    expect(res.status).toBe(200);
    expect(res.body.map(f => f.name)).toEqual(['Mine']);
  });

  it('rejects assigning a cell to a folder the user does not own', async () => {
    const { agent } = await makeUser();
    const { agent: other } = await makeUser();
    const foreign = (await other.post('/letter-folders').send({ name: 'Theirs' })).body;
    const res = await agent.post('/letter-blocks').send({ title: 'X', content: 'x', folderId: foreign.id });
    expect(res.status).toBe(404);
  });

  it('deleting a folder moves its cells back to root instead of deleting them', async () => {
    const { agent } = await makeUser();
    const folder = (await agent.post('/letter-folders').send({ name: 'Temp' })).body;
    const block = (await agent.post('/letter-blocks').send({ title: 'Keep', content: 'me', folderId: folder.id })).body;

    await agent.delete(`/letter-folders/${folder.id}`);

    const blocks = await agent.get('/letter-blocks');
    const still = blocks.body.find(b => b.id === block.id);
    expect(still).toBeTruthy();
    expect(still.folderId).toBeNull();
  });
});

describe('letter versions', () => {
  it('POST requires a name', async () => {
    const { agent } = await makeUser();
    const res = await agent.post('/letter-versions').send({ blockIds: [] });
    expect(res.status).toBe(400);
  });

  it('stores blockIds as a real array and updates order', async () => {
    const { agent } = await makeUser();
    const b1 = (await agent.post('/letter-blocks').send({ title: 'A', content: 'a' })).body;
    const b2 = (await agent.post('/letter-blocks').send({ title: 'B', content: 'b' })).body;
    const v = (await agent.post('/letter-versions').send({ name: 'V', blockIds: [b1.id, b2.id] })).body;

    const reordered = await agent.put(`/letter-versions/${v.id}`).send({ blockIds: [b2.id, b1.id] });
    expect(reordered.body.blockIds).toEqual([b2.id, b1.id]);

    const renamed = await agent.put(`/letter-versions/${v.id}`).send({ name: 'Renamed' });
    expect(renamed.body.name).toBe('Renamed');
    expect(renamed.body.blockIds).toEqual([b2.id, b1.id]);
  });

  it('ignores non-integer values inside blockIds', async () => {
    const { agent } = await makeUser();
    const v = await agent.post('/letter-versions').send({ name: 'V', blockIds: [1, 'x', null, 2.5] });
    expect(v.status).toBe(200);
    expect(v.body.blockIds).toEqual([1]);
  });

  it('DELETE removes the version', async () => {
    const { agent } = await makeUser();
    const v = (await agent.post('/letter-versions').send({ name: 'V', blockIds: [] })).body;
    const del = await agent.delete(`/letter-versions/${v.id}`);
    expect(del.status).toBe(200);
    expect((await agent.get('/letter-versions')).body).toHaveLength(0);
  });
});

describe('letter version groups', () => {
  it('creates, renames, and assigns versions to a group', async () => {
    const { agent } = await makeUser();
    const group = (await agent.post('/letter-version-groups').send({ name: 'Frontend roles' })).body;
    expect((await agent.get('/letter-version-groups')).body).toHaveLength(1);

    const version = (await agent.post('/letter-versions').send({
      name: 'React letter',
      blockIds: [],
      groupId: group.id,
    })).body;
    expect(version.groupId).toBe(group.id);

    const renamed = await agent.put(`/letter-version-groups/${group.id}`).send({ name: 'Web roles' });
    expect(renamed.body.name).toBe('Web roles');

    const movedToRoot = await agent.put(`/letter-versions/${version.id}`).send({ groupId: null });
    expect(movedToRoot.body.groupId).toBeNull();
  });

  it('rejects assigning a version to another user’s group', async () => {
    const { agent } = await makeUser();
    const { agent: other } = await makeUser();
    const foreignGroup = (await other.post('/letter-version-groups').send({ name: 'Private' })).body;

    const res = await agent.post('/letter-versions').send({
      name: 'My letter',
      blockIds: [],
      groupId: foreignGroup.id,
    });
    expect(res.status).toBe(404);
  });

  it('deleting a group keeps its versions and moves them to ungrouped', async () => {
    const { agent } = await makeUser();
    const group = (await agent.post('/letter-version-groups').send({ name: 'Temporary' })).body;
    const version = (await agent.post('/letter-versions').send({
      name: 'Keep me',
      blockIds: [],
      groupId: group.id,
    })).body;

    expect((await agent.delete(`/letter-version-groups/${group.id}`)).status).toBe(200);
    expect((await agent.get('/letter-version-groups')).body).toHaveLength(0);
    const versions = (await agent.get('/letter-versions')).body;
    expect(versions.find(item => item.id === version.id).groupId).toBeNull();
  });
});
