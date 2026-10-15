/**
 * Application error hierarchy.
 *
 * Services throw these; the HTTP layer is the only place that knows about
 * status codes. That separation is what keeps controllers thin and lets the
 * same service be called from a Server Component, a Route Handler or a test.
 */

export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'INTERNAL_ERROR';

export interface AppErrorOptions {
  /** Machine-readable detail, surfaced under `error.details`. */
  details?: unknown;
  /** Original error, kept for server-side logging only. */
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: unknown;
  /** Marks errors that are safe to show to an end user verbatim. */
  readonly expose = true;

  constructor(code: AppErrorCode, status: number, message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.details = options.details;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'The request was invalid', details?: unknown) {
    super('VALIDATION_ERROR', 400, message, { details });
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'You must be signed in to do that') {
    super('UNAUTHENTICATED', 401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to do that') {
    super('FORBIDDEN', 403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource', message?: string) {
    super('NOT_FOUND', 404, message ?? `${resource} was not found`);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'That action conflicts with the current state', details?: unknown) {
    super('CONFLICT', 409, message, { details });
  }
}

export class RateLimitedError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message = 'Too many requests. Please try again shortly') {
    super('RATE_LIMITED', 429, message);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'That file is too large') {
    super('PAYLOAD_TOO_LARGE', 413, message);
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message = 'That file type is not supported') {
    super('UNSUPPORTED_MEDIA_TYPE', 415, message);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Guards a value that came from outside the type system. Used when narrowing
 * `unknown` from a catch block or a JSON payload.
 */
export function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === 'string' ? error : 'Unknown error');
}
