const express = require('express');
const fs = require('fs');
const prisma = require('../config/prisma');
const { safeResolve } = require('../lib/validators');
const { authenticateToken } = require('../middleware/auth');
const { idParam } = require('../middleware/errorHandler');
const { uploadDir, resumesDir, upload } = require('../lib/uploads');

const router = express.Router();
router.param('id', idParam);

// Uploaded CVs / cover letters / resumes are private documents. They are served
// only to the authenticated owner — knowing the (random) filename is not enough.
// `ownsFile` returns true when the current user owns a row referencing the file.
const serveOwned = (rootDir, ownsFile) => [
  authenticateToken,
  async (req, res) => {
    const { filename } = req.params;
    const filePath = safeResolve(rootDir, filename);
    if (!filePath) return res.status(400).json({ error: 'Invalid filename' });
    try {
      if (!(await ownsFile(req.user.id, filename))) {
        return res.status(404).json({ error: 'File not found' });
      }
    } catch (e) {
      return res.status(500).json({ error: 'Failed to serve file' });
    }
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(500).json({ error: 'Failed to send file' });
      }
    });
  },
];

// A resume the user owns points at /uploads/resumes/<filename>.
const ownsResume = async (userId, filename) =>
  !!(await prisma.resume.findFirst({
    where: { userId, filePath: `/uploads/resumes/${filename}` },
  }));

// A cv/coverLetter the user owns is referenced by one of their applications.
const ownsAttachment = async (userId, filename) => {
  const url = `/uploads/${filename}`;
  return !!(await prisma.application.findFirst({
    where: { userId, OR: [{ cv: url }, { coverLetter: url }] },
  }));
};

router.get('/uploads/resumes/:filename', ...serveOwned(resumesDir, ownsResume));
router.get('/uploads/:filename', ...serveOwned(uploadDir, ownsAttachment));

// Attach a CV / cover letter file to an application.
router.post(
  '/applications/:id/upload',
  authenticateToken,
  upload.fields([{ name: 'cv' }, { name: 'coverLetter' }]),
  async (req, res) => {
    const files = req.files;
    try {
      const updateData = {};
      if (files['cv']) updateData.cv = `/uploads/${files['cv'][0].filename}`;
      if (files['coverLetter']) updateData.coverLetter = `/uploads/${files['coverLetter'][0].filename}`;

      const application = await prisma.application.update({
        where: { id: parseInt(req.params.id), userId: req.user.id },
        data: updateData,
      });
      res.json(application);
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to upload files' });
    }
  }
);

module.exports = router;
