const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { JWT_SECRET } = require('../config/env');

// Verifies the JWT cookie and attaches { id, email } to req.user.
const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Requires a valid token AND an admin user row.
const authenticateAdmin = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.sendStatus(401);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, isAdmin: true },
    });
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.sendStatus(403);
  }
};

// Best-effort audit log for admin actions.
const logAdminAction = async (adminId, action, details, ip) => {
  try {
    await prisma.adminLog.create({ data: { adminId, action, details, ip: ip || 'unknown' } });
  } catch (error) {
    console.error('Failed to log admin action:', error);
  }
};

const getClientIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';

module.exports = { authenticateToken, authenticateAdmin, logAdminAction, getClientIp };
