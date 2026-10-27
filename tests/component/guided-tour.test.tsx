import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import { GuidedTour } from '@/components/tour/GuidedTour';
import { TourLauncher } from '@/components/tour/TourLauncher';
import type { TourDefinition } from '@/lib/tours/types';

vi.mock('next/navigation', () => ({
  usePathname: () => '/partner-with-us',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

/**
 * The tour engine, exercised in jsdom.
 *
 * jsdom reports every element as zero-sized, so `Element.getBoundingClientRect`
 * is stubbed to a realistic box. That is the same class of caveat the header
 * tests document: without the stub the engine would (correctly) treat every
 * target as missing and render centred cards.
 */
/** The engine uses Mantine buttons, so the provider is required in tests too. */
function renderWithProvider(ui: ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

const tour: TourDefinition = {
  id: 'test-tour',
  title: 'Test walkthrough',
  storageKey: 'lifeevents.tour.test.v1',
  steps: [
    { id: 'one', title: 'First step', body: 'The first explanatory paragraph with enough words.' },
    {
      id: 'two',
      title: 'Second step',
      body: 'The second explanatory paragraph with enough words.',
      target: '#tour-target',
      path: '/partner-with-us',
      placement: 'bottom',
    },
    {
      id: 'three',
      title: 'Third step',
      body: 'The final explanatory paragraph with enough words.',
    },
  ],
};

let rectSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeEach(() => {
  window.localStorage.clear();
  rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    () =>
      ({
        top: 200,
        left: 300,
        width: 240,
        height: 48,
        bottom: 248,
        right: 540,
        x: 300,
        y: 200,
        toJSON: () => ({}),
      }) as DOMRect,
  );
});

afterEach(() => {
  rectSpy?.mockRestore();
  document.getElementById('tour-target')?.remove();
});

function renderTour(onClose = vi.fn()) {
  const target = document.createElement('div');
  target.id = 'tour-target';
  document.body.appendChild(target);
  const result = renderWithProvider(
    <GuidedTour tour={tour} pathname="/partner-with-us" onClose={onClose} />,
  );
  return { ...result, onClose };
}

describe('GuidedTour', () => {
  it('opens on the first step with a labelled dialog and focused heading', () => {
    renderTour();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'tour-step-title');
    expect(screen.getByRole('heading', { name: 'First step' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'First step' })).toHaveFocus();
    // The progress eyebrow and the polite announcement both name the step.
    expect(screen.getAllByText(/step 1 of 3/i).length).toBeGreaterThan(0);
  });

  it('advances and goes back without closing', async () => {
    const { onClose } = renderTour();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByRole('heading', { name: 'Second step' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByRole('heading', { name: 'First step' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('finishes on the last step', async () => {
    const { onClose } = renderTour();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /finish/i }));

    expect(onClose).toHaveBeenCalledWith('completed');
  });

  it('closes with Escape and with the close button, reporting dismissal', async () => {
    const { onClose } = renderTour();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledWith('dismissed');

    onClose.mockClear();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /close the tour/i }));
    expect(onClose).toHaveBeenCalledWith('dismissed');
  });

  it('offers a skip that dismisses without completing', async () => {
    const { onClose } = renderTour();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /skip tour/i }));
    expect(onClose).toHaveBeenCalledWith('dismissed');
  });

  it('falls back to a centred card when a target never renders', async () => {
    vi.useFakeTimers();
    const original = tour.steps;
    const brokenTour: TourDefinition = {
      ...tour,
      steps: [
        {
          id: 'missing',
          title: 'Missing target',
          body: 'This step points at an element that is never mounted, so it should still render.',
          target: '#never-rendered',
        },
      ],
    };

    renderWithProvider(
      <GuidedTour tour={brokenTour} pathname="/partner-with-us" onClose={vi.fn()} />,
    );
    expect(screen.getByRole('heading', { name: 'Missing target' })).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(4500);
    expect(screen.getByRole('heading', { name: 'Missing target' })).toBeInTheDocument();
    vi.useRealTimers();
    expect(original).toBe(tour.steps);
  });
});

describe('TourLauncher', () => {
  it('opens a standalone tour in place', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TourLauncher tour={tour} mode="standalone" label="Start walkthrough" />);

    await user.click(screen.getByRole('button', { name: 'Start walkthrough' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'First step' })).toBeInTheDocument();
  });

  it('asks the shell to run a cross-page tour instead of mounting one', async () => {
    const onStart = vi.fn();
    window.addEventListener('lifeevents:tour:start', onStart);

    const user = userEvent.setup();
    renderWithProvider(<TourLauncher tour={tour} label="Start walkthrough" />);

    await user.click(screen.getByRole('button', { name: 'Start walkthrough' }));

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    window.removeEventListener('lifeevents:tour:start', onStart);
  });
});
