import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // A single fresh SQLite file is shared across the suite, so run serially
    // to avoid cross-test interference on shared rows/counts.
    fileParallelism: false,
    globalSetup: './tests/globalSetup.js',
    setupFiles: ['./tests/setupEnv.js'],
    include: ['tests/**/*.test.js'],
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
