/**
 * Tiny class-name joiner.
 *
 * Mantine 9 does not re-export `cx` (verified: `require('@mantine/core').cx`
 * is `undefined`), and pulling in `clsx` would add a dependency for one
 * function. This is the same contract: strings, falsy values, nested arrays and
 * `{ className: boolean }` records.
 */
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | Record<string, boolean | null | undefined>
  | ReadonlyArray<ClassValue>;

export function cx(...values: ClassValue[]): string {
  const out: string[] = [];

  const walk = (value: ClassValue): void => {
    if (!value) return;
    if (typeof value === 'string' || typeof value === 'number') {
      out.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    for (const [key, enabled] of Object.entries(value)) {
      if (enabled) out.push(key);
    }
  };

  values.forEach(walk);
  return out.join(' ');
}
