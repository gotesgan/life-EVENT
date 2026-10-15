import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  /**
   * `server-only` throws by design when imported outside a React Server
   * Component environment. Vitest runs in plain Node, so it is aliased to an
   * empty module to keep server modules testable.
   */
  'server-only': fileURLToPath(new URL('./tests/setup/empty-module.ts', import.meta.url)),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'component',
          environment: 'jsdom',
          include: ['tests/component/**/*.test.tsx'],
          setupFiles: ['./tests/setup/component.ts'],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts', 'tests/api/**/*.test.ts'],
          setupFiles: ['./tests/setup/integration.ts'],
          globalSetup: ['./tests/setup/global-setup.ts'],
          // These tests share one PostgreSQL database and truncate between
          // files, so they must not run concurrently.
          fileParallelism: false,
          hookTimeout: 120_000,
          testTimeout: 60_000,
        },
      },
    ],
  },
});
