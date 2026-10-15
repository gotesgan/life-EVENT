/**
 * The `?next=` redirect target, sanitised.
 *
 * Only a same-origin absolute path is accepted. A protocol-relative value
 * (`//evil.test`), an absolute URL, or anything with a scheme is discarded,
 * which is what stops the sign-in form becoming an open redirect.
 */
export const DEFAULT_AUTH_DESTINATION = '/account';

export function safeNext(value: string | null | undefined): string {
  if (!value) return DEFAULT_AUTH_DESTINATION;

  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return DEFAULT_AUTH_DESTINATION;
  if (trimmed.startsWith('//')) return DEFAULT_AUTH_DESTINATION;
  // Reject backslash tricks (`/\evil.test`) that some browsers normalise.
  if (trimmed.startsWith('/\\')) return DEFAULT_AUTH_DESTINATION;

  return trimmed;
}

/** Appends `?next=` to a route, or nothing when the destination is the default. */
export function withNext(path: string, next: string): string {
  if (next === DEFAULT_AUTH_DESTINATION) return path;
  return `${path}?next=${encodeURIComponent(next)}`;
}
