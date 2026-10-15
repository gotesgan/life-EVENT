import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Research evidence: captured DOM dumps, screenshots and the throwaway
    // Playwright harnesses that produced them. Mechanical output, not source.
    'docs/research/**',
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Generated or produced by tooling, never hand-edited: the Prisma client,
    // Playwright's HTML report and trace bundles, and coverage output. ESLint's
    // flat config does not read .gitignore, so these must be listed here or
    // `pnpm lint` lints thousands of lines of vendored report JavaScript.
    'src/generated/**',
    'playwright-report/**',
    'test-results/**',
    'coverage/**',
    '.local-storage/**',
  ]),
]);

export default eslintConfig;
