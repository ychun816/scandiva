const express = require('express');
const prisma = require('../config/prisma');
const { isNotFound, parseBlockIds } = require('../lib/validators');
const { authenticateToken } = require('../middleware/auth');
const { idParam } = require('../middleware/errorHandler');

const router = express.Router();
router.param('id', idParam);

// Resolve a folderId from a request body value. Returns:
//   { skip: true }        — field absent, leave unchanged
//   { folderId: null }    — move to root
//   { folderId: <n> }     — validated, owned folder
//   { error, status }     — invalid or not owned
const resolveFolder = async (raw, userId) => {
  if (raw === undefined) return { skip: true };
  if (raw === null || raw === '') return { folderId: null };
  const fid = Number(raw);
  if (!Number.isInteger(fid) || fid <= 0) return { error: 'Invalid folder id', status: 400 };
  const folder = await prisma.letterFolder.findUnique({ where: { id: fid, userId } });
  if (!folder) return { error: 'Folder not found', status: 404 };
  return { folderId: fid };
};

const resolveVersionGroup = async (raw, userId) => {
  if (raw === undefined) return { skip: true };
  if (raw === null || raw === '') return { groupId: null };
  const groupId = Number(raw);
  if (!Number.isInteger(groupId) || groupId <= 0) {
    return { error: 'Invalid version group id', status: 400 };
  }
  const group = await prisma.letterVersionGroup.findUnique({ where: { id: groupId, userId } });
  if (!group) return { error: 'Version group not found', status: 404 };
  return { groupId };
};

// ----- Letter blocks (reusable paragraphs) -----

router.get('/letter-blocks', authenticateToken, async (req, res) => {
  try {
    const blocks = await prisma.letterBlock.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json(blocks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch letter blocks' });
  }
});

router.post('/letter-blocks', authenticateToken, async (req, res) => {
  const { title, content, folderId } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  try {
    const folder = await resolveFolder(folderId, req.user.id);
    if (folder.error) return res.status(folder.status).json({ error: folder.error });
    const block = await prisma.letterBlock.create({
      data: {
        title: title.trim(),
        content: content || '',
        folderId: folder.skip ? null : folder.folderId,
        userId: req.user.id,
      },
    });
    res.json(block);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create letter block' });
  }
});

router.put('/letter-blocks/:id', authenticateToken, async (req, res) => {
  const { title, content, folderId } = req.body;
  try {
    const folder = await resolveFolder(folderId, req.user.id);
    if (folder.error) return res.status(folder.status).json({ error: folder.error });
    const block = await prisma.letterBlock.update({
      where: { id: parseInt(req.params.id), userId: req.user.id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(content !== undefined ? { content } : {}),
        ...(folder.skip ? {} : { folderId: folder.folderId }),
      },
    });
    res.json(block);
  } catch (error) {
    if (isNotFound(error)) return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: 'Failed to update letter block' });
  }
});

// Deleting a block also unplugs it from every version that references it.
router.delete('/letter-blocks/:id', authenticateToken, async (req, res) => {
  const blockId = parseInt(req.params.id);
  try {
    await prisma.letterBlock.delete({ where: { id: blockId, userId: req.user.id } });
    const versions = await prisma.letterVersion.findMany({ where: { userId: req.user.id } });
    for (const v of versions) {
      const ids = parseBlockIds(v.blockIds);
      if (ids.includes(blockId)) {
        await prisma.letterVersion.update({
          where: { id: v.id },
          data: { blockIds: JSON.stringify(ids.filter((i) => i !== blockId)) },
        });
      }
    }
    res.json({ message: 'Letter block deleted' });
  } catch (error) {
    if (isNotFound(error)) return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: 'Failed to delete letter block' });
  }
});

// ----- Letter versions (ordered chains of block ids) -----

router.get('/letter-versions', authenticateToken, async (req, res) => {
  try {
    const versions = await prisma.letterVersion.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json(versions.map((v) => ({ ...v, blockIds: parseBlockIds(v.blockIds) })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch letter versions' });
  }
});

router.post('/letter-versions', authenticateToken, async (req, res) => {
  const { name, blockIds, groupId } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  try {
    const group = await resolveVersionGroup(groupId, req.user.id);
    if (group.error) return res.status(group.status).json({ error: group.error });
    const version = await prisma.letterVersion.create({
      data: {
        name: name.trim(),
        blockIds: JSON.stringify(Array.isArray(blockIds) ? blockIds : []),
        groupId: group.skip ? null : group.groupId,
        userId: req.user.id,
      },
    });
    res.json({ ...version, blockIds: parseBlockIds(version.blockIds) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create letter version' });
  }
});

router.put('/letter-versions/:id', authenticateToken, async (req, res) => {
  const { name, blockIds, groupId } = req.body;
  try {
    const group = await resolveVersionGroup(groupId, req.user.id);
    if (group.error) return res.status(group.status).json({ error: group.error });
    const version = await prisma.letterVersion.update({
      where: { id: parseInt(req.params.id), userId: req.user.id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(blockIds !== undefined ? { blockIds: JSON.stringify(Array.isArray(blockIds) ? blockIds : []) } : {}),
        ...(group.skip ? {} : { groupId: group.groupId }),
      },
    });
    res.json({ ...version, blockIds: parseBlockIds(version.blockIds) });
  } catch (error) {
    if (isNotFound(error)) return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: 'Failed to update letter version' });
  }
});

router.delete('/letter-versions/:id', authenticateToken, async (req, res) => {
  try {
    await prisma.letterVersion.delete({ where: { id: parseInt(req.params.id), userId: req.user.id } });
    res.json({ message: 'Letter version deleted' });
  } catch (error) {
    if (isNotFound(error)) return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: 'Failed to delete letter version' });
  }
});

// ----- Version groups (one-level categories for letter versions) -----

router.get('/letter-version-groups', authenticateToken, async (req, res) => {
  try {
    const groups = await prisma.letterVersionGroup.findMany({
      where: { userId: req.user.id },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch version groups' });
  }
});

router.post('/letter-version-groups', authenticateToken, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Group name is required' });
  try {
    const count = await prisma.letterVersionGroup.count({ where: { userId: req.user.id } });
    const group = await prisma.letterVersionGroup.create({
      data: { name: name.trim(), position: count, userId: req.user.id },
    });
    res.json(group);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create version group' });
  }
});

router.put('/letter-version-groups/:id', authenticateToken, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Group name is required' });
  try {
    const group = await prisma.letterVersionGroup.update({
      where: { id: parseInt(req.params.id), userId: req.user.id },
      data: { name: name.trim() },
    });
    res.json(group);
  } catch (error) {
    if (isNotFound(error)) return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: 'Failed to update version group' });
  }
});

// Deleting a group keeps its versions and moves them back to the root.
router.delete('/letter-version-groups/:id', authenticateToken, async (req, res) => {
  const groupId = parseInt(req.params.id);
  try {
    const group = await prisma.letterVersionGroup.findUnique({
      where: { id: groupId, userId: req.user.id },
    });
    if (!group) return res.status(404).json({ error: 'Version group not found' });
    await prisma.$transaction([
      prisma.letterVersion.updateMany({
        where: { groupId, userId: req.user.id },
        data: { groupId: null },
      }),
      prisma.letterVersionGroup.delete({ where: { id: groupId } }),
    ]);
    res.json({ message: 'Version group deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete version group' });
  }
});

// ----- Letter folders (one-level categories for cells) -----

router.get('/letter-folders', authenticateToken, async (req, res) => {
  try {
    const folders = await prisma.letterFolder.findMany({
      where: { userId: req.user.id },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(folders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

// Persist a new folder order. Body: { ids: [orderedFolderIds] }.
// Declared before '/letter-folders/:id' so the id-param guard doesn't claim it.
router.put('/letter-folders/reorder', authenticateToken, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.some((n) => !Number.isInteger(n))) {
    return res.status(400).json({ error: 'ids must be an array of integers' });
  }
  try {
    // Only reorder folders the user actually owns.
    const owned = await prisma.letterFolder.findMany({
      where: { userId: req.user.id },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((f) => f.id));
    const clean = ids.filter((id) => ownedIds.has(id));
    await prisma.$transaction(
      clean.map((id, index) =>
        prisma.letterFolder.update({ where: { id }, data: { position: index } })
      )
    );
    const folders = await prisma.letterFolder.findMany({
      where: { userId: req.user.id },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(folders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to reorder folders' });
  }
});

router.post('/letter-folders', authenticateToken, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Folder name is required' });
  try {
    // Append at the end of the current order.
    const count = await prisma.letterFolder.count({ where: { userId: req.user.id } });
    const folder = await prisma.letterFolder.create({
      data: { name: name.trim(), position: count, userId: req.user.id },
    });
    res.json(folder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

router.put('/letter-folders/:id', authenticateToken, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Folder name is required' });
  try {
    const folder = await prisma.letterFolder.update({
      where: { id: parseInt(req.params.id), userId: req.user.id },
      data: { name: name.trim() },
    });
    res.json(folder);
  } catch (error) {
    if (isNotFound(error)) return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: 'Failed to update folder' });
  }
});

// Deleting a folder moves its cells back to the root — cells are never lost.
router.delete('/letter-folders/:id', authenticateToken, async (req, res) => {
  const folderId = parseInt(req.params.id);
  try {
    const folder = await prisma.letterFolder.findUnique({ where: { id: folderId, userId: req.user.id } });
    if (!folder) return res.status(404).json({ error: 'Folder not found' });
    await prisma.$transaction([
      prisma.letterBlock.updateMany({ where: { folderId, userId: req.user.id }, data: { folderId: null } }),
      prisma.letterFolder.delete({ where: { id: folderId } }),
    ]);
    res.json({ message: 'Folder deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

module.exports = router;
