import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * True when this module is the process entry point rather than an import.
 *
 * Scripts that are both runnable and importable (the seed and the venue
 * importer, which the deploy bootstrap calls in-process) must not start their
 * CLI path when another module imports them.
 *
 * Both sides are resolved through `realpath` before comparing: on macOS
 * `process.argv[1]` is the path as typed (`/tmp/x.ts`) while `import.meta.url`
 * is the resolved one (`file:///private/tmp/x.ts`), so a plain string compare
 * silently returns false and the script does nothing.
 */
export function isDirectRun(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;

  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}
