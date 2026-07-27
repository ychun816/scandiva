const express = require('express');
const prisma = require('../config/prisma');
const { authenticateToken } = require('../middleware/auth');
const { idParam } = require('../middleware/errorHandler');

const router = express.Router();
router.param('id', idParam);

router.get('/applications/:id/stages', authenticateToken, async (req, res) => {
  try {
    const stages = await prisma.applicationStage.findMany({
      where: { applicationId: parseInt(req.params.id), application: { userId: req.user.id } },
      orderBy: { date: 'desc' },
    });
    res.json(stages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stages' });
  }
});

router.post('/applications/:id/stages', authenticateToken, async (req, res) => {
  const { stageName, status, date, notes } = req.body;
  if (!stageName || typeof stageName !== 'string' || !stageName.trim() ||
      !status || typeof status !== 'string' || !status.trim()) {
    return res.status(400).json({ error: 'Stage name and status are required' });
  }
  try {
    const application = await prisma.application.findUnique({
      where: { id: parseInt(req.params.id), userId: req.user.id },
    });
    if (!application) return res.status(404).json({ error: 'Application not found' });

    const stage = await prisma.applicationStage.create({
      data: {
        applicationId: parseInt(req.params.id),
        stageName, status,
        date: date ? new Date(date) : new Date(),
        notes,
      },
    });
    res.json(stage);
  } catch (error) {
    console.error('Create stage error:', error);
    res.status(500).json({ error: 'Failed to create stage' });
  }
});

router.put('/stages/:id', authenticateToken, async (req, res) => {
  const { stageName, status, date, notes } = req.body;
  try {
    const owned = await prisma.applicationStage.findFirst({
      where: { id: parseInt(req.params.id), application: { userId: req.user.id } },
    });
    if (!owned) return res.status(404).json({ error: 'Stage not found' });

    const stage = await prisma.applicationStage.update({
      where: { id: parseInt(req.params.id) },
      data: { stageName, status, date: date ? new Date(date) : undefined, notes },
    });
    res.json(stage);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update stage' });
  }
});

router.delete('/stages/:id', authenticateToken, async (req, res) => {
  try {
    const owned = await prisma.applicationStage.findFirst({
      where: { id: parseInt(req.params.id), application: { userId: req.user.id } },
    });
    if (!owned) return res.status(404).json({ error: 'Stage not found' });

    await prisma.applicationStage.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Stage deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete stage' });
  }
});

module.exports = router;
