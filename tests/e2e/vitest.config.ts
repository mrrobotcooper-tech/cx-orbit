import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['*.test.ts'],
    testTimeout: 90_000,
    hookTimeout: 90_000,
    pool: 'forks',
    fileParallelism: false,
  },
});
