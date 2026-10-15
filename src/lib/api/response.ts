import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError, RateLimitedError, ValidationError, isAppError, toError } from '@/lib/errors';

/** The single error envelope every endpoint returns. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, { status: 200, ...init });
}

export function jsonCreated<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, { status: 201, ...init });
}

export function jsonError(error: unknown): NextResponse<ApiErrorBody> {
  const appError = normaliseError(error);

  const body: ApiErrorBody = {
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details === undefined ? {} : { details: appError.details }),
    },
  };

  const headers: Record<string, string> = {};
  if (appError instanceof RateLimitedError) {
    headers['Retry-After'] = String(appError.retryAfterSeconds);
  }

  // Only genuinely unexpected failures are logged. Testing the *raw* error here
  // would print a full stack for every ordinary Zod 400, drowning the log in
  // noise and making real incidents hard to see — the normalised error is what
  // decides whether something actually went wrong.
  if (appError.code === 'INTERNAL_ERROR') {
    console.error('[api] unhandled error', toError(error));
  }

  return NextResponse.json(body, { status: appError.status, headers });
}

function normaliseError(error: unknown): AppError {
  if (isAppError(error)) return error;

  if (error instanceof z.ZodError) {
    return new ValidationError('The request was invalid', {
      fieldErrors: z.flattenError(error).fieldErrors,
      formErrors: z.flattenError(error).formErrors,
    });
  }

  return new AppError('INTERNAL_ERROR', 500, 'Something went wrong on our side');
}

export type RouteContext<TParams extends Record<string, string> = Record<string, never>> = {
  params: Promise<TParams>;
};

/**
 * Wraps a route handler so every endpoint shares one error convention.
 * Handlers return a `NextResponse`; anything thrown becomes a consistent
 * `ApiErrorBody` with an appropriate status code.
 */
export function apiHandler<TParams extends Record<string, string> = Record<string, never>>(
  handler: (request: NextRequest, context: RouteContext<TParams>) => Promise<NextResponse>,
) {
  return async (request: NextRequest, context: RouteContext<TParams>): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      // Next.js signals "this route is dynamic, stop prerendering" by throwing
      // an error carrying a `digest` (`DYNAMIC_SERVER_USAGE`,
      // `NEXT_PRERENDER_INTERRUPTED`, ...). That is framework control flow, not
      // a failure: swallowing it into a 500 breaks the build and silently turns
      // a correct route into a broken one. It must propagate untouched.
      if (isNextControlFlowError(error)) throw error;
      return jsonError(error);
    }
  };
}

/**
 * True for Next.js's internal prerender/rendering signals.
 *
 * The framework marks these with a string `digest`, which is the one property
 * that reliably distinguishes them from an application error; the message text
 * is checked as a secondary signal because it is more stable across the
 * framework's internal class names than an `instanceof` against a class that is
 * not part of the public API.
 */
function isNextControlFlowError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest === 'string' && digest.length > 0) return true;

  const message = (error as { message?: unknown }).message;
  return (
    typeof message === 'string' &&
    /bail out of prerendering|Dynamic server usage|NEXT_PRERENDER|NEXT_DYNAMIC/i.test(message)
  );
}

/** Parses and validates a JSON request body, rejecting malformed JSON as 400. */
export async function readJsonBody<TSchema extends z.ZodType>(
  request: NextRequest,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ValidationError('Request body must be valid JSON');
  }
  return schema.parse(raw) as z.infer<TSchema>;
}

/** Validates a plain object (query params) against a schema. */
export function parseInput<TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
): z.infer<TSchema> {
  return schema.parse(value) as z.infer<TSchema>;
}

export function searchParamsToObject(request: NextRequest): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  const params = request.nextUrl.searchParams;

  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    result[key] = all.length > 1 ? all : all[0];
  }

  return result;
}
