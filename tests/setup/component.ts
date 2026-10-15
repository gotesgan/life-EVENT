import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

/**
 * Component-test environment setup.
 *
 * Mantine's overlays and responsive components read browser APIs that jsdom
 * does not implement. They are stubbed here once so individual tests do not
 * have to, and stubbed deterministically (no animation, no real sizing) so a
 * component test can never be flaky because of a viewport or transition.
 */

function installMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function installResizeObserver(): void {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: ResizeObserverStub,
  });
  Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    value: ResizeObserverStub,
  });
}

function installScrollTo(): void {
  Object.defineProperty(window, 'scrollTo', { writable: true, value: vi.fn() });
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    writable: true,
    value: vi.fn(),
  });
}

beforeEach(() => {
  installMatchMedia();
  installResizeObserver();
  installScrollTo();
});

afterEach(() => {
  cleanup();
});
