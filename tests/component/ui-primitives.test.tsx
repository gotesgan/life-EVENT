import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import type { ReactElement } from 'react';
import { FilterChip } from '@/components/ui/FilterChip';
import { PriceTag } from '@/components/ui/PriceTag';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';

/**
 * Component tests for the shared primitives.
 *
 * These cover behaviour that is easy to regress and expensive to notice: the
 * unknown-price state, keyboard removal of a filter chip, and the accessible
 * naming of repeated controls. They deliberately do not test styling.
 */
function renderWithProvider(ui: ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('PriceTag', () => {
  it('renders a published range', () => {
    renderWithProvider(<PriceTag priceMin={100000} priceMax={300000} priceUnit="PER_EVENT" />);
    expect(screen.getByText(/1,00,000/)).toBeInTheDocument();
    expect(screen.getByText(/3,00,000/)).toBeInTheDocument();
    expect(screen.getByText('per event')).toBeInTheDocument();
  });

  it('never renders a zero price when no price is published', () => {
    renderWithProvider(<PriceTag priceMin={null} priceMax={null} priceUnit={null} />);
    expect(screen.getByText('Price on request')).toBeInTheDocument();
    expect(screen.queryByText(/₹0/)).not.toBeInTheDocument();
  });

  it('treats a zero bound as unknown rather than free', () => {
    renderWithProvider(<PriceTag priceMin={0} priceMax={0} priceUnit={null} />);
    expect(screen.getByText('Price on request')).toBeInTheDocument();
  });

  it('shows "From" only when one bound is genuinely known', () => {
    renderWithProvider(<PriceTag priceMin={250000} priceMax={null} priceUnit="PER_PLATE" />);
    expect(screen.getByText(/From/)).toBeInTheDocument();
  });
});

describe('FilterChip', () => {
  it('removes on click', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    renderWithProvider(<FilterChip label="Banquet hall" onRemove={onRemove} />);

    await user.click(screen.getByRole('button', { name: 'Remove filter: Banquet hall' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('is removable with the keyboard, because the affordance is a real button', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    renderWithProvider(<FilterChip label="Mumbai" onRemove={onRemove} />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Remove filter: Mumbai' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('names each chip distinctly so a row of chips is unambiguous', () => {
    renderWithProvider(
      <>
        <FilterChip label="Candid" onRemove={() => {}} />
        <FilterChip label="Documentary" onRemove={() => {}} />
      </>,
    );
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Remove filter: Candid' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove filter: Documentary' })).toBeInTheDocument();
  });

  it('does not fire when disabled', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    renderWithProvider(<FilterChip label="Verified" onRemove={onRemove} disabled />);

    await user.click(screen.getByRole('button', { name: 'Remove filter: Verified' }));
    expect(onRemove).not.toHaveBeenCalled();
  });
});

describe('StatusBadge', () => {
  it('renders the label text it is given', () => {
    renderWithProvider(<StatusBadge tone="success">Verified</StatusBadge>);
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('supports every documented tone without crashing', () => {
    const tones = ['neutral', 'brand', 'accent', 'success', 'warning', 'danger', 'info'] as const;
    for (const tone of tones) {
      const { unmount } = renderWithProvider(<StatusBadge tone={tone}>{tone}</StatusBadge>);
      expect(screen.getByText(tone)).toBeInTheDocument();
      unmount();
    }
  });
});

describe('EmptyState', () => {
  it('announces the empty result with a recoverable action', () => {
    renderWithProvider(
      <EmptyState
        title="No businesses match these filters"
        description="Try removing a filter or widening your budget."
        primaryAction={<button type="button">Clear all filters</button>}
      />,
    );

    expect(screen.getByText('No businesses match these filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear all filters' })).toBeInTheDocument();
  });
});
