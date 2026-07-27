// Creates a throwaway SQLite database and applies the Prisma schema to it once,
// before the whole test run. Removed afterwards so each run starts clean.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbFile = path.join(__dirname, '..', 'data', 'test.db');
const databaseUrl = `file:${dbFile}`;

const clean = () => {
  for (const f of [dbFile, `${dbFile}-journal`]) {
    if (existsSync(f)) rmSync(f);
  }
};

export async function setup() {
  clean();
  mkdirSync(path.dirname(dbFile), { recursive: true });
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: path.join(__dirname, '..'),
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

export async function teardown() {
  clean();
}
