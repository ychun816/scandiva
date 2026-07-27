import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  validatePassword,
  emailRegex,
  isNotFound,
  safeResolve,
  parseBlockIds,
  validateApplicationFields,
  APPLICATION_STATUSES,
  CONTRACT_TYPES,
  AI_ALLOWED_STATUS,
  AI_ALLOWED_CONTRACT,
} from '../src/lib/validators.js';

// Pure-function unit tests. These are fast, deterministic, and pin down the
// exact rules the HTTP layer relies on — a regression here breaks many routes.

describe('validatePassword', () => {
  it('accepts a password meeting every rule', () => {
    expect(validatePassword('Test1234!')).toBeNull();
    expect(validatePassword('Abcd1234')).toBeNull();
  });

  it('rejects passwords shorter than 8 chars', () => {
    expect(validatePassword('Ab1')).toMatch(/at least 8/i);
  });

  it('rejects a missing/empty password', () => {
    expect(validatePassword('')).toMatch(/at least 8/i);
    expect(validatePassword(undefined)).toMatch(/at least 8/i);
    expect(validatePassword(null)).toMatch(/at least 8/i);
  });

  it('requires an uppercase, a lowercase, and a digit', () => {
    expect(validatePassword('lowercase1')).toMatch(/uppercase/i);
    expect(validatePassword('UPPERCASE1')).toMatch(/lowercase/i);
    expect(validatePassword('NoDigitsHere')).toMatch(/number/i);
  });

  it('accepts a password exactly at the 8-char boundary', () => {
    expect(validatePassword('Abcdef1g')).toBeNull();
  });
});

describe('emailRegex', () => {
  it.each([
    'a@b.co',
    'first.last@example.com',
    'x+tag@sub.domain.io',
  ])('accepts %s', (email) => {
    expect(emailRegex.test(email)).toBe(true);
  });

  it.each([
    'not-an-email',
    'missing@domain',
    '@no-local.com',
    'has space@x.com',
    'two@@at.com',
    '',
  ])('rejects %s', (email) => {
    expect(emailRegex.test(email)).toBe(false);
  });
});

describe('isNotFound', () => {
  it('is true only for Prisma P2025', () => {
    expect(isNotFound({ code: 'P2025' })).toBe(true);
    expect(isNotFound({ code: 'P2002' })).toBe(false);
    expect(isNotFound(null)).toBe(false);
    expect(isNotFound(undefined)).toBe(false);
    expect(isNotFound(new Error('boom'))).toBe(false);
  });
});

describe('safeResolve (path-traversal guard)', () => {
  const root = path.resolve('/var/app/uploads');

  it('resolves an ordinary filename inside the root', () => {
    const out = safeResolve(root, 'abc.pdf');
    expect(out).toBe(path.join(root, 'abc.pdf'));
  });

  it('returns null for ../ traversal', () => {
    expect(safeResolve(root, '../secret.txt')).toBeNull();
    expect(safeResolve(root, '../../etc/passwd')).toBeNull();
    expect(safeResolve(root, '..')).toBeNull();
  });

  it('returns null for an absolute path escaping the root', () => {
    expect(safeResolve(root, '/etc/passwd')).toBeNull();
  });

  it('treats a nested subpath under the root as allowed', () => {
    const out = safeResolve(root, 'resumes/cv.pdf');
    expect(out).toBe(path.join(root, 'resumes', 'cv.pdf'));
  });
});

describe('parseBlockIds', () => {
  it('parses a JSON array of integers', () => {
    expect(parseBlockIds('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('drops non-integers (floats, strings, null)', () => {
    expect(parseBlockIds('[1,"x",2.5,null,3]')).toEqual([1, 3]);
  });

  it('returns [] for null/empty/garbage', () => {
    expect(parseBlockIds(null)).toEqual([]);
    expect(parseBlockIds('')).toEqual([]);
    expect(parseBlockIds('not json')).toEqual([]);
    expect(parseBlockIds('{}')).toEqual([]);
  });

  it('returns [] when the JSON is an object, not an array', () => {
    expect(parseBlockIds('{"a":1}')).toEqual([]);
  });
});

describe('validateApplicationFields', () => {
  it('accepts every canonical status and contract type', () => {
    for (const status of APPLICATION_STATUSES) {
      expect(validateApplicationFields({ status })).toBeNull();
    }
    for (const contractType of CONTRACT_TYPES) {
      expect(validateApplicationFields({ contractType })).toBeNull();
    }
  });

  it('accepts a payload with neither field (partial update)', () => {
    expect(validateApplicationFields({})).toBeNull();
    expect(validateApplicationFields()).toBeNull();
  });

  it('treats undefined/null/empty status as "leave unchanged"', () => {
    expect(validateApplicationFields({ status: undefined })).toBeNull();
    expect(validateApplicationFields({ status: null })).toBeNull();
    expect(validateApplicationFields({ status: '' })).toBeNull();
  });

  it('rejects an out-of-domain status', () => {
    expect(validateApplicationFields({ status: 'Bogus' })).toMatch(/invalid status/i);
  });

  it('rejects an out-of-domain contract type', () => {
    expect(validateApplicationFields({ contractType: 'Slavery' })).toMatch(/contract type/i);
  });
});

describe('AI vocab constants', () => {
  it('AI status list matches the canonical statuses', () => {
    expect(AI_ALLOWED_STATUS).toEqual(APPLICATION_STATUSES);
  });

  it('AI contract list allows an empty string plus every canonical type', () => {
    expect(AI_ALLOWED_CONTRACT).toContain('');
    for (const c of CONTRACT_TYPES) expect(AI_ALLOWED_CONTRACT).toContain(c);
  });
});
