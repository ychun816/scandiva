const express = require('express');
const path = require('path');
const fs = require('fs');
const prisma = require('../config/prisma');
const { authenticateToken, authenticateAdmin, logAdminAction, getClientIp } = require('../middleware/auth');
const { rateLimit, adminLimiter } = require('../middleware/rateLimit');

const router = express.Router();
const guard = [rateLimit(adminLimiter), authenticateAdmin];

router.get('/admin/stats', ...guard, async (req, res) => {
  try {
    await logAdminAction(req.user.id, 'view_stats', null, getClientIp(req));

    const totalUsers = await prisma.user.count();
    const totalApplications = await prisma.application.count();
    const totalResumes = await prisma.resume.count();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newUsersWeek = await prisma.user.count({ where: { createdAt: { gte: weekAgo } } });
    const activeUsers = await prisma.user.count({ where: { applications: { some: {} } } });
    const applicationsByStatus = await prisma.application.groupBy({ by: ['status'], _count: { status: true } });
    const resumes = await prisma.resume.findMany({ select: { fileSize: true } });
    const totalStorageBytes = resumes.reduce((sum, r) => sum + (r.fileSize || 0), 0);

    res.json({
      users: { total: totalUsers, newThisWeek: newUsersWeek, active: activeUsers },
      applications: {
        total: totalApplications,
        byStatus: applicationsByStatus.reduce((acc, item) => { acc[item.status] = item._count.status; return acc; }, {}),
      },
      resumes: { total: totalResumes, storageMB: Math.round(totalStorageBytes / (1024 * 1024) * 100) / 100 },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

router.get('/admin/users', ...guard, async (req, res) => {
  try {
    await logAdminAction(req.user.id, 'view_users', null, getClientIp(req));
    const users = await prisma.user.findMany({
      select: {
        id: true, email: true, name: true, isAdmin: true, createdAt: true,
        _count: { select: { applications: true, resumes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/admin/system', ...guard, async (req, res) => {
  try {
    await logAdminAction(req.user.id, 'view_system', null, getClientIp(req));

    const dbPath = path.join(__dirname, '../../data/dev.db');
    let dbSizeMB = 0;
    if (fs.existsSync(dbPath)) {
      dbSizeMB = Math.round(fs.statSync(dbPath).size / (1024 * 1024) * 100) / 100;
    }

    let uploadsSizeMB = 0;
    const uploadsPath = path.join(__dirname, '../../uploads');
    if (fs.existsSync(uploadsPath)) {
      const getSize = (dir) => {
        let size = 0;
        for (const file of fs.readdirSync(dir)) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          size += stat.isDirectory() ? getSize(filePath) : stat.size;
        }
        return size;
      };
      uploadsSizeMB = Math.round(getSize(uploadsPath) / (1024 * 1024) * 100) / 100;
    }

    res.json({
      database: { sizeMB: dbSizeMB },
      uploads: { sizeMB: uploadsSizeMB },
      memory: {
        usedMB: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
        totalMB: Math.round(process.memoryUsage().heapTotal / (1024 * 1024)),
      },
      uptime: Math.round(process.uptime()),
      nodeVersion: process.version,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch system info' });
  }
});

router.get('/admin/logs', ...guard, async (req, res) => {
  try {
    await logAdminAction(req.user.id, 'view_logs', null, getClientIp(req));
    const logs = await prisma.adminLog.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: { admin: { select: { email: true } } },
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

router.get('/admin/check', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { isAdmin: true } });
    res.json({ isAdmin: user?.isAdmin || false });
  } catch (error) {
    res.json({ isAdmin: false });
  }
});

module.exports = router;
