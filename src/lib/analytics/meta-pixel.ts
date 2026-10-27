export type MetaEventName =
  'PageView' | 'ViewContent' | 'Search' | 'Lead' | 'Contact' | 'CompleteRegistration';

export interface MetaEventOptions {
  /**
   * Deduplication id. The Conversions API sends the same value, and Meta merges
   * the browser and server copies when both arrive within 48 hours.
   */
  eventId?: string;
  params?: Record<string, unknown>;
}

interface FbqWindow extends Window {
  fbq?: (...args: unknown[]) => void;
}

/**
 * Browser-side Meta Pixel event.
 *
 * A no-op when the pixel has not loaded — which is the normal state until the
 * visitor grants analytics consent. Callers therefore never need to know whether
 * tracking is active; the conversation is a business operation first.
 */
export function trackMetaEvent(name: MetaEventName, options: MetaEventOptions = {}): void {
  if (typeof window === 'undefined') return;

  const fbq = (window as FbqWindow).fbq;
  if (typeof fbq !== 'function') return;

  if (options.eventId) {
    fbq('track', name, options.params ?? {}, { eventID: options.eventId });
  } else {
    fbq('track', name, options.params ?? {});
  }
}

export const CONSENT_STORAGE_KEY = 'lifeevents-analytics-consent';
export const CONSENT_EVENT = 'lifeevents:consent-changed';

export type AnalyticsConsent = 'granted' | 'denied';

export function readAnalyticsConsent(): AnalyticsConsent | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  return value === 'granted' || value === 'denied' ? value : null;
}

export function writeAnalyticsConsent(value: AnalyticsConsent): void {
  window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}
