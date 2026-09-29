import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // One shared database: run files one after another.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
