const { authRateLimitMax, adminRateLimitMax } = require('../config/env');

// Simple in-memory sliding-window limiter, keyed by client IP.
// For multi-instance production this should be backed by Redis.
const rateLimitStore = new Map();

const rateLimit = (options) => (req, res, next) => {
  const key = req.ip;
  const now = Date.now();
  const windowStart = now - options.windowMs;

  if (!rateLimitStore.has(key)) rateLimitStore.set(key, []);
  const requests = rateLimitStore.get(key).filter((time) => time > windowStart);
  requests.push(now);
  rateLimitStore.set(key, requests);

  if (requests.length > options.max) {
    return res.status(429).json(options.message);
  }
  next();
};

const authLimiter = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: authRateLimitMax,
  message: { error: 'Too many attempts, please try again later' },
};

const adminLimiter = {
  windowMs: 60 * 1000, // 1 minute
  max: adminRateLimitMax,
  message: { error: 'Too many admin requests, please try again later' },
};

module.exports = { rateLimit, authLimiter, adminLimiter };
