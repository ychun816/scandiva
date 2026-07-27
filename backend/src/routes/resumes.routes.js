const express = require('express');
const path = require('path');
const fs = require('fs');
const prisma = require('../config/prisma');
const { isNotFound } = require('../lib/validators');
const { authenticateToken } = require('../middleware/auth');
const { idParam } = require('../middleware/errorHandler');
const { resumeUpload } = require('../lib/uploads');

const router = express.Router();
router.param('id', idParam);

router.get('/resumes', authenticateToken, async (req, res) => {
  try {
    const resumes = await prisma.resume.findMany({
      where: { userId: req.user.id },
      orderBy: { uploadedAt: 'desc' },
    });
    res.json(resumes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch resumes' });
  }
});

router.post('/resumes', authenticateToken, resumeUpload.single('file'), async (req, res) => {
  try {
    const { name } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    if (!name || name.trim() === '') return res.status(400).json({ error: 'Resume name is required' });

    const resume = await prisma.resume.create({
      data: {
        name: name.trim(),
        fileName: file.originalname,
        filePath: `/uploads/resumes/${file.filename}`,
        fileSize: file.size,
        userId: req.user.id,
      },
    });
    res.json(resume);
  } catch (error) {
    console.error('Resume upload error:', error);
    res.status(500).json({ error: 'Failed to upload resume' });
  }
});

router.get('/resumes/:id', authenticateToken, async (req, res) => {
  try {
    const resume = await prisma.resume.findUnique({
      where: { id: parseInt(req.params.id), userId: req.user.id },
      include: { applications: { select: { id: true, company: true, position: true } } },
    });
    if (!resume) return res.status(404).json({ error: 'Resume not found' });
    res.json(resume);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch resume' });
  }
});

router.get('/resumes/:id/download', authenticateToken, async (req, res) => {
  try {
    const resume = await prisma.resume.findUnique({
      where: { id: parseInt(req.params.id), userId: req.user.id },
    });
    if (!resume) return res.status(404).json({ error: 'Resume not found' });

    const filePath = path.join(__dirname, '../..', resume.filePath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on server' });
    res.download(filePath, resume.fileName);
  } catch (error) {
    res.status(500).json({ error: 'Failed to download resume' });
  }
});

router.put('/resumes/:id', authenticateToken, async (req, res) => {
  const { name } = req.body;
  try {
    if (!name || name.trim() === '') return res.status(400).json({ error: 'Resume name is required' });
    const resume = await prisma.resume.update({
      where: { id: parseInt(req.params.id), userId: req.user.id },
      data: { name: name.trim() },
    });
    res.json(resume);
  } catch (error) {
    if (isNotFound(error)) return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: 'Failed to update resume' });
  }
});

router.delete('/resumes/:id', authenticateToken, async (req, res) => {
  try {
    const resume = await prisma.resume.findUnique({
      where: { id: parseInt(req.params.id), userId: req.user.id },
    });
    if (!resume) return res.status(404).json({ error: 'Resume not found' });

    const filePath = path.join(__dirname, '../..', resume.filePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await prisma.resume.delete({ where: { id: parseInt(req.params.id), userId: req.user.id } });
    res.json({ message: 'Resume deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete resume' });
  }
});

module.exports = router;
