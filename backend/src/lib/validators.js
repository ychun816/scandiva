const path = require('path');

// Password strength policy for registration and password changes.
const validatePassword = (password) => {
  if (!password || password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  return null; // Valid
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Prisma "record to update/delete not found" — surface as 404 rather than 500.
const isNotFound = (e) => !!e && e.code === 'P2025';

// Resolve a user-supplied filename inside a root dir; null if it escapes the
// root (path traversal via ../ or encoded slashes).
const safeResolve = (rootDir, filename) => {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, filename);
  return resolved.startsWith(root + path.sep) ? resolved : null;
};

// Parse a letter version's blockIds JSON into a clean integer array.
const parseBlockIds = (raw) => {
  try {
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr.filter((n) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
};

// Canonical domain vocabularies, shared by manual create/update and AI parsing.
const APPLICATION_STATUSES = ['To Apply', 'Applied', 'Interviewing', 'Offer', 'Rejected'];
const CONTRACT_TYPES = ['Full-time', 'Part-time', 'Contract', 'CDI', 'CDD', 'Intern', 'Freelance'];

// AI parsing tolerates an empty contract type; keep those aliases for that path.
const AI_ALLOWED_STATUS = APPLICATION_STATUSES;
const AI_ALLOWED_CONTRACT = ['', ...CONTRACT_TYPES];

// Validate the domain-constrained fields of an application payload. Only checks
// fields that are actually present, so partial updates stay valid.
// Returns an error string, or null when acceptable.
const validateApplicationFields = ({ status, contractType } = {}) => {
  if (status !== undefined && status !== null && status !== '' && !APPLICATION_STATUSES.includes(status)) {
    return `Invalid status. Must be one of: ${APPLICATION_STATUSES.join(', ')}`;
  }
  if (contractType !== undefined && contractType !== null && contractType !== '' && !CONTRACT_TYPES.includes(contractType)) {
    return `Invalid contract type. Must be one of: ${CONTRACT_TYPES.join(', ')}`;
  }
  return null;
};

module.exports = {
  validatePassword,
  emailRegex,
  isNotFound,
  safeResolve,
  parseBlockIds,
  APPLICATION_STATUSES,
  CONTRACT_TYPES,
  validateApplicationFields,
  AI_ALLOWED_STATUS,
  AI_ALLOWED_CONTRACT,
};
