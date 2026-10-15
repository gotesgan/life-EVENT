'use client';

import { notifications } from '@mantine/notifications';

/**
 * Client helpers for the customer-facing mutations.
 *
 * Two rules, mirrored from the admin client:
 *
 * 1. A non-2xx response is an error, never an optimistic success. The server is
 *    the authority on ownership and validity; the UI does not second-guess it.
 * 2. After a successful write the caller calls `router.refresh()`. Nothing is
 *    patched into local state from a request body, so the page always shows what
 *    the database actually contains.
 */

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export class AccountApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(message: string, options: { status: number; code: string; details?: unknown }) {
    super(message);
    this.name = 'AccountApiError';
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

export async function accountFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(path, { ...init, method, headers, cache: 'no-store' });
  } catch {
    throw new AccountApiError('Could not reach the server. Check your connection and try again.', {
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
        : `The request failed (${response.status}).`;
    throw new AccountApiError(error?.message ?? fallback, {
      status: response.status,
      code: error?.code ?? 'HTTP_ERROR',
      details: error?.details,
    });
  }

  return body as T;
}

/** Extracts `{ fieldErrors: { field: string[] } }` (the Zod flatten shape). */
export function fieldErrorsFrom(error: unknown): Record<string, string> {
  if (!(error instanceof AccountApiError)) return {};
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
  if (error instanceof AccountApiError) return error.message;
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
