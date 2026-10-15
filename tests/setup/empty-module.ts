/**
 * Alias target for `server-only` under Vitest.
 *
 * See vitest.config.ts — the real package throws outside a React Server
 * Component environment, which would make server modules untestable.
 */
export {};
