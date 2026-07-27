import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Runs before the app module is imported in each test file.
// Force test-only configuration so we never touch the real dev database,
// and keep rate-limit ceilings high enough that ordinary tests don't trip them.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-do-not-use-in-prod';
process.env.DATABASE_URL = `file:${path.join(__dirname, '..', 'data', 'test.db')}`;
// Kept modest so the rate-limit test trips quickly; test users each get a
// unique client IP (see helpers) so normal auth traffic never shares a bucket.
process.env.AUTH_RATE_LIMIT_MAX = process.env.AUTH_RATE_LIMIT_MAX || '100';
process.env.ADMIN_RATE_LIMIT_MAX = process.env.ADMIN_RATE_LIMIT_MAX || '2000';
