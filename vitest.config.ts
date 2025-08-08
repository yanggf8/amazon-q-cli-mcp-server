import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 15000, // 15 seconds
    hookTimeout: 10000, // 10 seconds
  },
});
