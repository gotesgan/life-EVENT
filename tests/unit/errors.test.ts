import { describe, expect, it } from 'vitest';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  RateLimitedError,
  UnauthenticatedError,
  UnsupportedMediaTypeError,
  ValidationError,
  isAppError,
  toError,
  type AppErrorCode,
} from '@/lib/errors';

interface ErrorCase {
  name: string;
  create: () => AppError;
  code: AppErrorCode;
  status: number;
}

const CASES: ErrorCase[] = [
  {
    name: 'ValidationError',
    create: () => new ValidationError(),
    code: 'VALIDATION_ERROR',
    status: 400,
  },
  {
    name: 'UnauthenticatedError',
    create: () => new UnauthenticatedError(),
    code: 'UNAUTHENTICATED',
    status: 401,
  },
  { name: 'ForbiddenError', create: () => new ForbiddenError(), code: 'FORBIDDEN', status: 403 },
  {
    name: 'NotFoundError',
    create: () => new NotFoundError('Business'),
    code: 'NOT_FOUND',
    status: 404,
  },
  { name: 'ConflictError', create: () => new ConflictError(), code: 'CONFLICT', status: 409 },
  {
    name: 'RateLimitedError',
    create: () => new RateLimitedError(42),
    code: 'RATE_LIMITED',
    status: 429,
  },
  {
    name: 'PayloadTooLargeError',
    create: () => new PayloadTooLargeError(),
    code: 'PAYLOAD_TOO_LARGE',
    status: 413,
  },
  {
    name: 'UnsupportedMediaTypeError',
    create: () => new UnsupportedMediaTypeError(),
    code: 'UNSUPPORTED_MEDIA_TYPE',
    status: 415,
  },
];

describe('AppError subclasses', () => {
  for (const testCase of CASES) {
    describe(testCase.name, () => {
      it(`carries code ${testCase.code} and status ${testCase.status}`, () => {
        const error = testCase.create();
        expect(error.code).toBe(testCase.code);
        expect(error.status).toBe(testCase.status);
        expect(error.expose).toBe(true);
      });

      it('is an AppError and a plain Error', () => {
        const error = testCase.create();
        expect(error).toBeInstanceOf(AppError);
        expect(error).toBeInstanceOf(Error);
        expect(isAppError(error)).toBe(true);
      });

      it('names itself after its subclass', () => {
        expect(testCase.create().name).toBe(testCase.name);
      });
    });
  }

  it('uses a sensible default message for every subclass', () => {
    for (const testCase of CASES) {
      expect(testCase.create().message.length).toBeGreaterThan(0);
    }
  });
});

describe('NotFoundError', () => {
  it('builds "Resource was not found" from the resource name', () => {
    expect(new NotFoundError('Enquiry').message).toBe('Enquiry was not found');
  });

  it('prefers an explicit message when one is supplied', () => {
    expect(new NotFoundError('Enquiry', 'Custom message').message).toBe('Custom message');
  });
});

describe('ValidationError details', () => {
  it('carries the structured details supplied by the caller', () => {
    const details = { filter: 'style', allowed: ['candid'] };
    const error = new ValidationError('Unknown value', details);
    expect(error.details).toEqual(details);
  });

  it('leaves details undefined when none are supplied', () => {
    expect(new ValidationError().details).toBeUndefined();
  });
});

describe('RateLimitedError', () => {
  it('carries the retry-after seconds on the instance as well as the code', () => {
    const error = new RateLimitedError(90);
    expect(error.retryAfterSeconds).toBe(90);
    expect(error.status).toBe(429);
  });
});

describe('AppError options', () => {
  it('preserves the original cause for server-side logging', () => {
    const cause = new Error('database exploded');
    const error = new AppError('INTERNAL_ERROR', 500, 'Something went wrong', { cause });
    expect(error.cause).toBe(cause);
  });

  it('accepts a custom code and status for the base class', () => {
    const error = new AppError('INTERNAL_ERROR', 500, 'boom');
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.status).toBe(500);
  });
});

describe('isAppError', () => {
  it('rejects plain errors, strings and nullish values', () => {
    expect(isAppError(new Error('plain'))).toBe(false);
    expect(isAppError('VALIDATION_ERROR')).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError(undefined)).toBe(false);
    expect(isAppError({ code: 'VALIDATION_ERROR', status: 400 })).toBe(false);
  });

  it('narrows an unknown catch value to AppError', () => {
    const caught: unknown = new ConflictError('nope');
    if (isAppError(caught)) {
      expect(caught.status).toBe(409);
    } else {
      throw new Error('Expected isAppError to narrow the value');
    }
  });
});

describe('toError', () => {
  it('returns an existing Error unchanged', () => {
    const error = new Error('kept');
    expect(toError(error)).toBe(error);
  });

  it('wraps a string', () => {
    expect(toError('boom').message).toBe('boom');
  });

  it('wraps unknown non-Error values without inventing a message', () => {
    expect(toError({ weird: true }).message).toBe('Unknown error');
    expect(toError(null).message).toBe('Unknown error');
  });
});
