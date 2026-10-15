import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { ReactElement } from 'react';
import { CustomerModerationControl } from '@/components/admin/CustomerModerationControl';

/**
 * Customer moderation.
 *
 * `adminUpdateCustomerStatus` refuses to change the acting administrator's own
 * account and refuses to suspend another administrator. The control must
 * therefore never offer those actions: a menu item whose only outcome is a 400
 * is worse than no menu item, because it looks like a working feature.
 *
 * Styling is not asserted — only whether the control is actionable and whether
 * the refusal is explained in place.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/admin/customers',
}));

function renderWithProvider(ui: ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('CustomerModerationControl', () => {
  it('is disabled for the signed-in administrator\u2019s own account', () => {
    renderWithProvider(
      <CustomerModerationControl
        userId="me"
        name="Priya Sharma"
        status="ACTIVE"
        role="ADMIN"
        isSelf
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Moderation actions for Priya Sharma' }),
    ).toBeDisabled();
  });

  it('is disabled for another administrator', () => {
    renderWithProvider(
      <CustomerModerationControl
        userId="other-admin"
        name="Ravi Menon"
        status="ACTIVE"
        role="ADMIN"
        isSelf={false}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Moderation actions for Ravi Menon' }),
    ).toBeDisabled();
  });

  it('is actionable for a customer account', () => {
    renderWithProvider(
      <CustomerModerationControl
        userId="u1"
        name="Anita Rao"
        status="ACTIVE"
        role="CUSTOMER"
        isSelf={false}
      />,
    );

    expect(screen.getByRole('button', { name: 'Moderation actions for Anita Rao' })).toBeEnabled();
  });

  it('is actionable for a suspended customer so the account can be restored', () => {
    renderWithProvider(
      <CustomerModerationControl
        userId="u2"
        name="Vikram Shah"
        status="SUSPENDED"
        role="CUSTOMER"
        isSelf={false}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Moderation actions for Vikram Shah' }),
    ).toBeEnabled();
  });
});
