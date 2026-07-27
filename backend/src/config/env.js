const dotenv = require('dotenv');

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

// In production a weak or placeholder secret means every session is forgeable —
// fail fast rather than boot with a known key.
const PLACEHOLDER_SECRETS = new Set([
  'change-this-secret-in-production',
  'change-me',
  'secret',
  'local-dev-secret-change-me',
]);
if (isProduction && (JWT_SECRET.length < 32 || PLACEHOLDER_SECRETS.has(JWT_SECRET))) {
  console.error('FATAL: JWT_SECRET must be a strong, unique value (>= 32 chars) in production');
  process.exit(1);
}

module.exports = {
  JWT_SECRET,
  port: process.env.PORT || 3000,
  isProduction,
  corsOrigins: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:5173', 'http://localhost:8080', 'http://localhost', 'https://localhost'],
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  adminRateLimitMax: Number(process.env.ADMIN_RATE_LIMIT_MAX) || 30,
  allowRegistration: process.env.ALLOW_REGISTRATION
    ? process.env.ALLOW_REGISTRATION === 'true'
    : !isProduction,
};
