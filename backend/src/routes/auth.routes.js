const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');
const { JWT_SECRET, isProduction, allowRegistration } = require('../config/env');
const { validatePassword, emailRegex } = require('../lib/validators');
const { authenticateToken } = require('../middleware/auth');
const { rateLimit, authLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const cookieOptions = { httpOnly: true, secure: isProduction, sameSite: 'lax' };
const signToken = (user) => jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

router.post('/auth/register', rateLimit(authLimiter), async (req, res) => {
  if (!allowRegistration) {
    return res.status(403).json({ error: 'Registration is disabled by the server administrator' });
  }
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ error: passwordError });
  if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, password: hashedPassword, name } });
    res.cookie('token', signToken(user), cookieOptions);
    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'Email already registered' });
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/auth/login', rateLimit(authLimiter), async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });
    res.cookie('token', signToken(user), cookieOptions);
    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

router.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (error) {
    res.sendStatus(404);
  }
});

router.put('/auth/profile', authenticateToken, async (req, res) => {
  const { name } = req.body;
  try {
    const user = await prisma.user.update({ where: { id: req.user.id }, data: { name } });
    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.get('/auth/preferences', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { notifyEmail: true, notifyReminders: true, notifyDigest: true },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

router.put('/auth/preferences', authenticateToken, async (req, res) => {
  const { notifyEmail, notifyReminders, notifyDigest } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { notifyEmail, notifyReminders, notifyDigest },
    });
    res.json({ notifyEmail: user.notifyEmail, notifyReminders: user.notifyReminders, notifyDigest: user.notifyDigest });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

router.put('/auth/password', authenticateToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const passwordError = validatePassword(newPassword);
  if (passwordError) return res.status(400).json({ error: passwordError });
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const validPassword = await bcrypt.compare(oldPassword, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Current password is incorrect' });
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashedPassword } });
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

router.get('/auth/stats', authenticateToken, async (req, res) => {
  try {
    const applications = await prisma.application.findMany({ where: { userId: req.user.id } });
    res.json({
      total: applications.length,
      toApply: applications.filter((a) => a.status === 'To Apply').length,
      applied: applications.filter((a) => a.status === 'Applied').length,
      interviewing: applications.filter((a) => a.status === 'Interviewing').length,
      offer: applications.filter((a) => a.status === 'Offer').length,
      rejected: applications.filter((a) => a.status === 'Rejected').length,
      // Archive is an independent flag now, not a status value.
      archived: applications.filter((a) => a.isArchived).length,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

router.delete('/auth/account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    // Capture file paths before the DB rows go away.
    const resumes = await prisma.resume.findMany({ where: { userId } });

    // Delete all user-owned rows atomically — a mid-sequence failure rolls back.
    await prisma.$transaction([
      prisma.applicationStage.deleteMany({ where: { application: { userId } } }),
      prisma.application.deleteMany({ where: { userId } }),
      prisma.resume.deleteMany({ where: { userId } }),
      prisma.letterVersion.deleteMany({ where: { userId } }),
      prisma.letterVersionGroup.deleteMany({ where: { userId } }),
      prisma.letterBlock.deleteMany({ where: { userId } }),
      prisma.letterFolder.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    // Files are best-effort cleanup after the DB commit; a failure here doesn't
    // resurrect the account.
    for (const resume of resumes) {
      const filePath = path.join(__dirname, '../..', resume.filePath);
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) {
        console.error('Failed to remove resume file during account deletion:', e.message);
      }
    }

    res.clearCookie('token');
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;
