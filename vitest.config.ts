import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['layers/**/*.spec.ts'],
    environment: 'node',
  },
});
