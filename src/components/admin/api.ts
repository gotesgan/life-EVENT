'use client';

import { notifications } from '@mantine/notifications';

/**
 * Thin wrapper around the admin API routes.
 *
 * Two rules this module exists to enforce:
 *
 * 1. **A 401/403 is surfaced, never swallowed.** The UI is not the gate — every
 *    route re-runs `requireAdmin` server-side — so a session that expired
 *    mid-session must produce a visible error instead of an optimistic success.
 *    `adminFetch` throws on any non-2xx response with the server's own message.
 * 2. **Mutations refresh, they do not guess.** Callers call `router.refresh()`
 *    after a successful write so the server re-reads the database; nothing is
 *    patched into local state from the request body.
 */

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export class AdminApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(message: string, options: { status: number; code: string; details?: unknown }) {
    super(message);
    this.name = 'AdminApiError';
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

const SAFE_IDEMPOTENT = ['GET', 'HEAD'];

export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      method,
      headers,
      // Mutations must never be served from a cache.
      cache: SAFE_IDEMPOTENT.includes(method) ? 'no-store' : 'no-store',
    });
  } catch {
    throw new AdminApiError('Could not reach the server. Check your connection and try again.', {
      status: 0,
      code: 'NETWORK_ERROR',
    });
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const error = (body as ApiErrorBody | null)?.error;
    const fallback =
      response.status === 401
        ? 'Your session has expired. Sign in again to continue.'
        : response.status === 403
          ? 'Your account does not have administrator access.'
          : `The request failed (${response.status}).`;
    throw new AdminApiError(error?.message ?? fallback, {
      status: response.status,
      code: error?.code ?? 'HTTP_ERROR',
      details: error?.details,
    });
  }

  return body as T;
}

/** Extracts `{ fieldErrors: { field: string[] } }` (Zod flatten shape) if present. */
export function fieldErrorsFrom(error: unknown): Record<string, string> {
  if (!(error instanceof AdminApiError)) return {};
  const details = error.details;
  if (!details || typeof details !== 'object') return {};
  const fieldErrors = (details as { fieldErrors?: unknown }).fieldErrors;
  if (!fieldErrors || typeof fieldErrors !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fieldErrors as Record<string, unknown>)) {
    if (Array.isArray(value) && value.length > 0) out[key] = String(value[0]);
    else if (typeof value === 'string') out[key] = value;
  }
  return out;
}

export function errorMessage(error: unknown): string {
  if (error instanceof AdminApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

export function notifySuccess(message: string, title?: string): void {
  notifications.show({
    color: 'brand',
    title,
    message,
    autoClose: 4000,
    withAutoCloseProgress: true,
  });
}

export function notifyError(error: unknown, title = 'That did not work'): void {
  notifications.show({
    color: 'red',
    title,
    message: errorMessage(error),
    autoClose: 7000,
  });
}

export interface MutationResult {
  ok: boolean;
  status: number;
  message: string;
}

/**
 * Runs one mutation and reports the outcome without throwing, so a bulk action
 * can count successes and failures honestly instead of aborting on the first
 * refusal.
 */
export async function runMutation(path: string, init: RequestInit = {}): Promise<MutationResult> {
  try {
    await adminFetch(path, init);
    return { ok: true, status: 200, message: 'OK' };
  } catch (error) {
    const status = error instanceof AdminApiError ? error.status : 0;
    return { ok: false, status, message: errorMessage(error) };
  }
}

export async function postJson<T>(path: string, body?: unknown): Promise<T> {
  return adminFetch<T>(path, {
    method: 'POST',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export async function patchJson<T>(path: string, body?: unknown): Promise<T> {
  return adminFetch<T>(path, {
    method: 'PATCH',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export async function putJson<T>(path: string, body?: unknown): Promise<T> {
  return adminFetch<T>(path, {
    method: 'PUT',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export async function deleteJson<T>(path: string): Promise<T> {
  return adminFetch<T>(path, { method: 'DELETE' });
}
