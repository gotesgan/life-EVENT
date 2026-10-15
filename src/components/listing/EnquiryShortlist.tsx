'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { Button } from '@mantine/core';
import { IconCheck, IconPlus, IconSend } from '@tabler/icons-react';
import ClientLink from '@/components/ui/ClientLink';
import { cx } from '@/components/ui/cx';
import { buildQuery, setSelectedListings } from '@/lib/filter-state';
import classes from './EnquiryShortlist.module.css';

/**
 * The multi-provider shortlist.
 *
 * The product's core promise is "tell the businesses you chose about your event
 * once" (`/enquire`), but before this module every entry point built
 * `?enquire=` from exactly one slug, so a second business silently replaced the
 * first and there was no basket to fill. This is that basket.
 *
 * ## Where the state lives
 *
 * In this module, mirrored to `sessionStorage`, exposed to React through
 * `useSyncExternalStore`.
 *
 * Why not the URL, when the URL is the state container everywhere else on the
 * site (`useFilterNavigation`)? Because the shortlist has to outlive the page
 * that fills it. A browse URL is rebuilt on every filter change and a listing
 * card links to a bare `/vendors/<slug>`, so an `enquire` parameter carried on
 * `/vendors` is dropped the moment the visitor opens a profile — the basket
 * would empty exactly when it is needed. `sessionStorage` is per-tab and
 * per-visitor: the right scope for a shortlist, and no server round trip (and
 * therefore no re-run of the search query) on every "add".
 *
 * The `enquire` **URL parameter** is still the contract with the enquiry form:
 * `useEnquiryTarget` serialises the shortlist through `setSelectedListings`, the
 * one helper that owns that encoding, so `/enquire?enquire=a,b` means the same
 * thing no matter who produced it. A shared or hand-written `enquire` link keeps
 * working, because the form reads it directly.
 */

/**
 * The enquiry form accepts at most this many businesses before it truncates
 * (`MAX_PROVIDERS` in `src/app/enquire/page.tsx`, which caps the resolved
 * provider list). Capped here too, so the shortlist can never promise a
 * selection the form will silently drop.
 */
export const MAX_SHORTLISTED_BUSINESSES = 10;

const STORAGE_KEY = 'liveenvt-enquiry-shortlist';
/** Stable identity for the server snapshot and the empty client state. */
const EMPTY: readonly string[] = [];

let shortlist: readonly string[] = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function persist(): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(shortlist));
  } catch {
    // Storage disabled (private mode, quota). The in-memory list still works for
    // this page; losing it on reload is better than blocking the control.
  }
}

/**
 * Reads the stored list once, on the first subscription — never during render,
 * so the server HTML and the first client render agree and there is no
 * hydration mismatch. Every later change flows through `setShortlist`.
 */
function hydrate(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;

  let parsed: unknown;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    parsed = raw === null ? null : JSON.parse(raw);
  } catch {
    return;
  }
  if (!Array.isArray(parsed)) return;

  const stored = parsed.filter(
    (value): value is string => typeof value === 'string' && value !== '',
  );
  if (stored.length === 0) return;

  shortlist = [...new Set(stored)].slice(0, MAX_SHORTLISTED_BUSINESSES);
  notify();
}

function setShortlist(next: readonly string[]): void {
  shortlist = [...new Set(next)].slice(0, MAX_SHORTLISTED_BUSINESSES);
  hydrated = true;
  persist();
  notify();
}

/** Adds or removes one listing. Idempotent; a no-op once the cap is reached. */
function toggleShortlistedListing(slug: string): void {
  if (shortlist.includes(slug)) {
    setShortlist(shortlist.filter((item) => item !== slug));
    return;
  }
  if (shortlist.length >= MAX_SHORTLISTED_BUSINESSES) return;
  setShortlist([...shortlist, slug]);
}

function subscribeToEnquiryShortlist(listener: () => void): () => void {
  listeners.add(listener);
  hydrate();
  return () => {
    listeners.delete(listener);
  };
}

function getEnquiryShortlist(): readonly string[] {
  return shortlist;
}

function getEnquiryShortlistServerSnapshot(): readonly string[] {
  return EMPTY;
}

/** The visitor's current shortlist. Empty on the server and before hydration. */
export function useEnquiryShortlist(): readonly string[] {
  return useSyncExternalStore(
    subscribeToEnquiryShortlist,
    getEnquiryShortlist,
    getEnquiryShortlistServerSnapshot,
  );
}

/** `/enquire?enquire=…` with this listing merged into the shortlist, and the
 *  number of businesses that URL will contact. */
export function useEnquiryTarget(slug: string): { href: string; count: number } {
  const selected = useEnquiryShortlist();

  return useMemo(() => {
    const merged = [...new Set([...selected, slug])];

    // The form contacts at most MAX businesses (its own `MAX_PROVIDERS` cap),
    // and it truncates silently. A full shortlist plus the listing just clicked
    // would exceed that, so the clicked business takes the last place instead of
    // being dropped — the visitor asked to send the enquiry from *this* card.
    const ordered =
      merged.length > MAX_SHORTLISTED_BUSINESSES
        ? [...new Set([slug, ...selected])].slice(0, MAX_SHORTLISTED_BUSINESSES)
        : merged;

    return {
      href: `/enquire${buildQuery(setSelectedListings({}, ordered))}`,
      count: ordered.length,
    };
  }, [selected, slug]);
}

export interface AddToEnquiryButtonProps {
  slug: string;
  /** The business name, so a row of identical "Add to enquiry" controls is not. */
  name: string;
  /**
   * Renders the control as the 32×32 icon toggle that sits over a card's media
   * (guide §1.5, slot 1b) instead of the full-width labelled button. The
   * accessible name is identical in both forms; only the visible label changes,
   * and `title` carries it for a pointer user.
   */
  compact?: boolean;
}

/**
 * Adds or removes one business from the shortlist.
 *
 * A real `<button>` with `aria-pressed`, so its on/off state is exposed to
 * assistive technology through the control's own semantics rather than through
 * colour; the visible label states the same thing in words.
 *
 * The accessible name is built from the same string as the visible label plus
 * the business name, so a row of identical controls is unambiguous and the
 * visible text stays a contiguous substring of the accessible name (WCAG 2.5.3,
 * which voice control depends on). A `visually-hidden` span cannot be used for
 * the suffix: the accessible-name algorithm trims each text node's leading
 * space, so it would announce "Add to enquiryabout Banquet Hall".
 */
export function AddToEnquiryButton({ slug, name, compact = false }: AddToEnquiryButtonProps) {
  const selected = useEnquiryShortlist();
  const isSelected = selected.includes(slug);
  const atLimit = !isSelected && selected.length >= MAX_SHORTLISTED_BUSINESSES;

  const label = isSelected
    ? 'Added to enquiry'
    : atLimit
      ? `Enquiry limit of ${MAX_SHORTLISTED_BUSINESSES} reached`
      : 'Add to enquiry';

  return (
    <button
      type="button"
      className={cx(
        classes.toggle,
        compact && classes.toggleCompact,
        isSelected && classes.toggleOn,
      )}
      aria-pressed={isSelected}
      aria-label={`${label} about ${name}`}
      title={compact ? label : undefined}
      disabled={atLimit}
      onClick={() => toggleShortlistedListing(slug)}
    >
      {isSelected ? (
        <IconCheck className={classes.icon} size="1rem" stroke={1.5} aria-hidden />
      ) : (
        <IconPlus className={classes.icon} size="1rem" stroke={1.5} aria-hidden />
      )}
      {compact ? null : label}
    </button>
  );
}

export interface EnquirySubmitLinkProps {
  slug: string;
  name: string;
  /** The surface's own CTA class — the card owns its action styling. */
  className: string;
  iconClassName?: string;
}

/**
 * The listing card's primary action, carrying the whole shortlist with it.
 *
 * Submitting from business B no longer discards A: the visitor lands on
 * `/enquire?enquire=a,b`, and the label states how many businesses will receive
 * the enquiry so the basket is legible before it is sent. Without this merge the
 * "choose the businesses you want" copy is false — that was F13.
 */
export function EnquirySubmitLink({
  slug,
  name,
  className,
  iconClassName,
}: EnquirySubmitLinkProps) {
  const { href, count } = useEnquiryTarget(slug);
  const label = `Send enquiry${count > 1 ? ` (${count} businesses)` : ''}`;

  return (
    <ClientLink className={className} href={href} aria-label={`${label} about ${name}`}>
      <IconSend className={iconClassName} size="1rem" stroke={1.5} aria-hidden />
      {label}
    </ClientLink>
  );
}

export interface EnquirySubmitButtonProps {
  slug: string;
}

/** The profile rail's primary action, with the same shortlist merge. */
export function EnquirySubmitButton({ slug }: EnquirySubmitButtonProps) {
  const { href, count } = useEnquiryTarget(slug);

  return (
    <Button
      component={ClientLink}
      href={href}
      fullWidth
      leftSection={<IconSend size="1rem" stroke={1.5} aria-hidden />}
    >
      Send an enquiry{count > 1 ? ` (${count} businesses)` : ''}
    </Button>
  );
}
