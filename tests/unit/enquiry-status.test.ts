import { describe, expect, it } from 'vitest';
import { EnquiryStatus } from '@/generated/prisma/enums';
import { ConflictError } from '@/lib/errors';
import {
  ADMIN_STATUS_ORDER,
  ALLOWED_TRANSITIONS,
  CUSTOMER_CANCELLABLE_STATUSES,
  CUSTOMER_STATUS_DESCRIPTIONS,
  CUSTOMER_STATUS_LABELS,
  PROVIDER_SHARED_STATUSES,
  TERMINAL_STATUSES,
  assertTransition,
  canCustomerCancel,
  canTransition,
  deriveEnquiryStatus,
  isProviderShared,
  isTerminal,
  type EnquiryStatusValue,
} from '@/server/domain/enquiry-status';

const ALL_STATUSES = Object.values(EnquiryStatus) as EnquiryStatusValue[];

function captureError(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the callback to throw, but it returned normally');
}

describe('ALLOWED_TRANSITIONS table completeness', () => {
  it('has an entry for every status in the enum', () => {
    expect(Object.keys(ALLOWED_TRANSITIONS).sort()).toEqual([...ALL_STATUSES].sort());
  });

  it('only targets real statuses', () => {
    const known = new Set<string>(ALL_STATUSES);
    for (const [from, targets] of Object.entries(ALLOWED_TRANSITIONS)) {
      expect(known.has(from)).toBe(true);
      for (const to of targets) {
        expect(known.has(to)).toBe(true);
      }
    }
  });

  it('never lists a self-transition as allowed', () => {
    for (const status of ALL_STATUSES) {
      expect(ALLOWED_TRANSITIONS[status]).not.toContain(status);
    }
  });
});

describe('canTransition across the complete from/to matrix', () => {
  for (const from of ALL_STATUSES) {
    for (const to of ALL_STATUSES) {
      it(`${from} -> ${to} is ${ALLOWED_TRANSITIONS[from].includes(to) ? 'allowed' : 'refused'}`, () => {
        const expected = from !== to && ALLOWED_TRANSITIONS[from].includes(to);
        expect(canTransition(from, to)).toBe(expected);
      });
    }
  }

  it('refuses every self-transition even when the pair exists in the table', () => {
    for (const status of ALL_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });
});

describe('assertTransition', () => {
  it('does not throw for any allowed pair', () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALLOWED_TRANSITIONS[from]) {
        expect(() => assertTransition(from, to)).not.toThrow();
      }
    }
  });

  it('treats a same-status assertion as a no-op', () => {
    for (const status of ALL_STATUSES) {
      expect(() => assertTransition(status, status)).not.toThrow();
    }
  });

  it('throws a ConflictError that names the from, to and allowed moves', () => {
    const error = captureError(() => assertTransition('NEW', 'CONVERTED'));

    expect(error).toBeInstanceOf(ConflictError);
    const conflict = error as ConflictError;
    expect(conflict.code).toBe('CONFLICT');
    expect(conflict.status).toBe(409);
    expect(conflict.message).toContain('NEW');
    expect(conflict.message).toContain('CONVERTED');
    expect(conflict.details).toEqual({
      from: 'NEW',
      to: 'CONVERTED',
      allowed: ALLOWED_TRANSITIONS.NEW,
    });
  });

  it('refuses every disallowed pair in the matrix', () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        if (from === to || ALLOWED_TRANSITIONS[from].includes(to)) continue;
        expect(() => assertTransition(from, to)).toThrow(ConflictError);
      }
    }
  });
});

describe('terminal statuses', () => {
  it('marks exactly CONVERTED and CANCELLED as terminal', () => {
    const terminal = ALL_STATUSES.filter((status) => isTerminal(status));
    expect(terminal.sort()).toEqual(['CANCELLED', 'CONVERTED'].sort());
    expect([...TERMINAL_STATUSES].sort()).toEqual(['CANCELLED', 'CONVERTED'].sort());
  });

  it('gives terminal statuses no outgoing transitions at all', () => {
    for (const status of TERMINAL_STATUSES) {
      expect(ALLOWED_TRANSITIONS[status]).toEqual([]);
    }
  });
});

describe('CONVERTED reachability', () => {
  it('is reachable from SHARED_WITH_PROVIDER only', () => {
    const sources = ALL_STATUSES.filter((status) => canTransition(status, 'CONVERTED'));
    expect(sources).toEqual(['SHARED_WITH_PROVIDER']);
  });

  it('cannot be reached from any pre-share stage', () => {
    for (const status of ['NEW', 'CONTACTED', 'QUALIFIED'] as const) {
      expect(canTransition(status, 'CONVERTED')).toBe(false);
    }
  });
});

describe('PROVIDER_SHARED_STATUSES', () => {
  it('contains exactly SHARED_WITH_PROVIDER and CONVERTED', () => {
    expect([...PROVIDER_SHARED_STATUSES].sort()).toEqual(
      ['CONVERTED', 'SHARED_WITH_PROVIDER'].sort(),
    );
  });

  it('matches isProviderShared for every status', () => {
    for (const status of ALL_STATUSES) {
      expect(isProviderShared(status)).toBe(PROVIDER_SHARED_STATUSES.includes(status));
    }
  });
});

describe('deriveEnquiryStatus', () => {
  it('returns NEW for an enquiry with no provider leads', () => {
    expect(deriveEnquiryStatus([])).toBe('NEW');
  });

  it('returns NEW when every lead is NEW', () => {
    expect(deriveEnquiryStatus(['NEW', 'NEW', 'NEW'])).toBe('NEW');
  });

  it('returns CONVERTED as soon as any lead is CONVERTED', () => {
    expect(deriveEnquiryStatus(['NEW', 'CONVERTED'])).toBe('CONVERTED');
    expect(deriveEnquiryStatus(['CONVERTED', 'CANCELLED'])).toBe('CONVERTED');
    expect(deriveEnquiryStatus(['CONVERTED'])).toBe('CONVERTED');
  });

  it('returns CANCELLED only when every lead is CANCELLED', () => {
    expect(deriveEnquiryStatus(['CANCELLED', 'CANCELLED'])).toBe('CANCELLED');
    expect(deriveEnquiryStatus(['CANCELLED', 'NEW'])).toBe('NEW');
  });

  it('keeps SPAM and DUPLICATE as separate triage queues', () => {
    // These are different queues for an administrator: a spam enquiry must not
    // disappear into the duplicate queue. An all-spam set was previously
    // collapsed to DUPLICATE, which hid every honeypot-tripped submission from
    // the spam filter.
    expect(deriveEnquiryStatus(['SPAM'])).toBe('SPAM');
    expect(deriveEnquiryStatus(['SPAM', 'SPAM'])).toBe('SPAM');

    expect(deriveEnquiryStatus(['DUPLICATE'])).toBe('DUPLICATE');
    expect(deriveEnquiryStatus(['DUPLICATE', 'DUPLICATE'])).toBe('DUPLICATE');

    // A mixed set has no single meaning, so it reports the less destructive of
    // the two rather than claiming everything is spam.
    expect(deriveEnquiryStatus(['DUPLICATE', 'SPAM'])).toBe('DUPLICATE');
  });

  it('returns LOST when every lead is closed out (LOST/CANCELLED/DUPLICATE/SPAM)', () => {
    expect(deriveEnquiryStatus(['LOST'])).toBe('LOST');
    expect(deriveEnquiryStatus(['LOST', 'CANCELLED'])).toBe('LOST');
    expect(deriveEnquiryStatus(['LOST', 'SPAM'])).toBe('LOST');
  });

  it('falls through to the open-stage winner for a mixed open/closed set', () => {
    expect(deriveEnquiryStatus(['LOST', 'NEW'])).toBe('NEW');
    expect(deriveEnquiryStatus(['LOST', 'CONTACTED'])).toBe('CONTACTED');
    expect(deriveEnquiryStatus(['CANCELLED', 'QUALIFIED'])).toBe('QUALIFIED');
    expect(deriveEnquiryStatus(['DUPLICATE', 'SHARED_WITH_PROVIDER'])).toBe('SHARED_WITH_PROVIDER');
  });

  it('lets any SHARED_WITH_PROVIDER beat QUALIFIED', () => {
    expect(deriveEnquiryStatus(['QUALIFIED', 'SHARED_WITH_PROVIDER'])).toBe('SHARED_WITH_PROVIDER');
    expect(deriveEnquiryStatus(['SHARED_WITH_PROVIDER', 'SHARED_WITH_PROVIDER'])).toBe(
      'SHARED_WITH_PROVIDER',
    );
    expect(deriveEnquiryStatus(['QUALIFIED', 'QUALIFIED'])).toBe('QUALIFIED');
  });

  it('ranks QUALIFIED above CONTACTED above NEW', () => {
    expect(deriveEnquiryStatus(['CONTACTED', 'QUALIFIED'])).toBe('QUALIFIED');
    expect(deriveEnquiryStatus(['NEW', 'CONTACTED'])).toBe('CONTACTED');
  });

  it('is order-independent for the same set of child statuses', () => {
    const permutations: EnquiryStatusValue[][] = [
      ['NEW', 'QUALIFIED', 'LOST'],
      ['QUALIFIED', 'LOST', 'NEW'],
      ['LOST', 'NEW', 'QUALIFIED'],
    ];
    for (const permutation of permutations) {
      expect(deriveEnquiryStatus(permutation)).toBe('QUALIFIED');
    }
  });
});

describe('canCustomerCancel boundaries', () => {
  it('allows cancellation only for NEW, CONTACTED and QUALIFIED', () => {
    const cancellable = ALL_STATUSES.filter((status) => canCustomerCancel(status));
    expect(cancellable.sort()).toEqual(['CONTACTED', 'NEW', 'QUALIFIED'].sort());
    expect([...CUSTOMER_CANCELLABLE_STATUSES].sort()).toEqual(
      ['CONTACTED', 'NEW', 'QUALIFIED'].sort(),
    );
  });

  it('refuses cancellation once the details may have reached a provider', () => {
    for (const status of [...PROVIDER_SHARED_STATUSES, ...TERMINAL_STATUSES] as const) {
      expect(canCustomerCancel(status)).toBe(false);
    }
  });
});

describe('customer-facing copy', () => {
  it('provides a label and a description for every status', () => {
    for (const status of ALL_STATUSES) {
      expect(CUSTOMER_STATUS_LABELS[status]).toBeTruthy();
      expect(CUSTOMER_STATUS_DESCRIPTIONS[status]).toBeTruthy();
    }
  });

  it('never leaks internal operational vocabulary to the customer', () => {
    const customerCopy = Object.values(CUSTOMER_STATUS_LABELS).join(' ').toLowerCase();
    expect(customerCopy).not.toContain('qualified');
    expect(customerCopy).not.toContain('shared_with_provider');
  });

  it('lists every status once in the admin workflow order', () => {
    expect([...ADMIN_STATUS_ORDER].sort()).toEqual([...ALL_STATUSES].sort());
    expect(new Set(ADMIN_STATUS_ORDER).size).toBe(ADMIN_STATUS_ORDER.length);
  });
});
