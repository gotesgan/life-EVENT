'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@mantine/core';
import { IconArrowLeft, IconArrowRight, IconX } from '@tabler/icons-react';
import type { TourDefinition, TourStep } from '@/lib/tours/types';
import classes from './GuidedTour.module.css';

export interface GuidedTourProps {
  tour: TourDefinition;
  /** Called when the visitor finishes, skips or presses Escape. */
  onClose: (outcome: 'completed' | 'dismissed') => void;
  /** Current admin pathname, used to know when a navigating step has arrived. */
  pathname?: string;
  /** Cross-page navigation for steps that live on another route. */
  onNavigate?: (path: string) => void;
}

interface TargetBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TOOLTIP_GAP = 14;
const VIEWPORT_MARGIN = 16;
const TOOLTIP_WIDTH = 376;

/** Reduced-motion preference, read on the client only. */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function measure(target: Element): TargetBox {
  const rect = target.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

/**
 * A tour step may point at a control that is not mounted yet: the host navigates
 * on the same tick and the destination streams in. Poll briefly rather than
 * assuming; if it never appears, fall back to a centred card so the visitor is
 * never stuck on an invisible step.
 */
function useTargetRect(selector: string | undefined, pathname: string | undefined) {
  /**
   * The selector is stored with the box so a measurement can never be shown
   * against a different step. Without this, a step change left the previous
   * step's highlight and tooltip in place until the new target was found.
   */
  const [measured, setMeasured] = useState<{ selector: string; box: TargetBox } | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    /* A centred step has no target; stale measurements are ignored by the
       renderer below rather than cleared synchronously here. */
    if (!selector) return;

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const read = (): boolean => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return false;
      setMeasured({ selector, box: measure(element) });
      setMissing(false);
      return true;
    };

    const poll = () => {
      if (cancelled) return;
      if (read()) return;
      attempts += 1;
      if (attempts >= 40) {
        setMissing(true);
        setMeasured(null);
        return;
      }
      timer = setTimeout(poll, 100);
    };

    /* Scroll the target into the middle of the viewport before measuring; the
       smooth scroll is skipped for reduced-motion visitors. */
    const element = document.querySelector(selector);
    if (element) {
      element.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    }

    /* Deferred by a tick: measuring immediately would set state synchronously
       inside the effect, which React flags as a cascading render. */
    timer = setTimeout(poll, 0);

    const remeasure = () => read();
    window.addEventListener('resize', remeasure);
    window.addEventListener('scroll', remeasure, { passive: true });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('scroll', remeasure);
    };
  }, [selector, pathname]);

  return {
    box: selector && measured?.selector === selector ? measured.box : null,
    missing,
  };
}

/** Places the tooltip beside the target, clamped to the viewport. */
function tooltipPosition(box: TargetBox | null, placement: TourStep['placement']) {
  if (!box) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  const { width, height } = { width: window.innerWidth, height: window.innerHeight };
  const preferred = placement ?? 'bottom';

  let top = box.top + box.height + TOOLTIP_GAP;
  let left = box.left + box.width / 2 - TOOLTIP_WIDTH / 2;

  if (preferred === 'top') top = box.top - TOOLTIP_GAP - 220;
  if (preferred === 'left') {
    top = box.top + box.height / 2 - 120;
    left = box.left - TOOLTIP_WIDTH - TOOLTIP_GAP;
  }
  if (preferred === 'right') {
    top = box.top + box.height / 2 - 120;
    left = box.left + box.width + TOOLTIP_GAP;
  }

  // Flip when the preferred side would overflow, then clamp.
  if (top + 240 > height) top = Math.max(VIEWPORT_MARGIN, box.top - 240);
  if (top < VIEWPORT_MARGIN) top = Math.min(height - 260, box.top + box.height + TOOLTIP_GAP);
  left = Math.min(Math.max(VIEWPORT_MARGIN, left), width - TOOLTIP_WIDTH - VIEWPORT_MARGIN);

  return { top: `${top}px`, left: `${left}px`, transform: 'none' };
}

/**
 * The guided-tour engine.
 *
 * Three deliberate properties:
 *
 *  - **It never hides the interface it is explaining.** The dim overlay is four
 *    rectangles around the target rather than one blurred sheet, the highlighted
 *    control stays at full opacity, and the step text sits beside it.
 *  - **It is keyboard-complete.** Escape leaves, arrow keys move, Tab stays
 *    inside the card, and each step change focuses the heading and announces the
 *    new step. Reduced-motion visitors get no entrance animation.
 *  - **A step cannot get stuck.** If a target is missing or not yet mounted, the
 *    engine polls briefly and then presents the step as a centred card.
 */
export function GuidedTour({ tour, onClose, pathname, onNavigate }: GuidedTourProps) {
  const [index, setIndex] = useState(0);
  const step = tour.steps[index];
  const isFirst = index === 0;
  const isLast = index === tour.steps.length - 1;

  const cardRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  /* Navigate to the step's route when it is not the one we are on. */
  useEffect(() => {
    if (!step?.path || !pathname || !onNavigate) return;
    if (pathname === step.path) return;
    onNavigate(step.path);
  }, [step, pathname, onNavigate]);

  const measured = useTargetRect(step?.target, pathname);
  const box = step?.target ? measured.box : null;
  const missing = step?.target ? measured.missing : false;

  const close = useCallback((outcome: 'completed' | 'dismissed') => onClose(outcome), [onClose]);
  const next = useCallback(() => {
    if (isLast) close('completed');
    else setIndex((current) => current + 1);
  }, [close, isLast]);
  const back = useCallback(() => setIndex((current) => Math.max(0, current - 1)), []);

  /* Lock page scroll while the tour is open, and restore the previous value. */
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  /* Mark the document while the tour is open so other floating surfaces (the
     analytics consent banner) can stand down rather than compete for the corner. */
  useEffect(() => {
    document.body.dataset.tourOpen = 'true';
    return () => {
      delete document.body.dataset.tourOpen;
    };
  }, []);

  /* Focus the step heading and announce it on every change. */
  useEffect(() => {
    headingRef.current?.focus();
  }, [index]);

  /* Keyboard: Escape, arrows, and a focus trap inside the card. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close('dismissed');
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'Enter') {
        const target = event.target as HTMLElement | null;
        if (target?.tagName === 'BUTTON' || target?.tagName === 'A') return;
        event.preventDefault();
        next();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        back();
        return;
      }
      if (event.key !== 'Tab' || !cardRef.current) return;

      const focusable = cardRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [back, close, next]);

  if (!step) return null;
  if (typeof document === 'undefined') return null;

  const cardStyle = tooltipPosition(missing ? null : box, step.placement);
  const highlight = box
    ? {
        top: `${box.top - 6}px`,
        left: `${box.left - 6}px`,
        width: `${box.width + 12}px`,
        height: `${box.height + 12}px`,
      }
    : null;

  return createPortal(
    <div className={classes.layer}>
      {box ? (
        <>
          <div
            className={classes.dim}
            style={{ insetBlockStart: 0, insetBlockEnd: 'auto', height: box.top - 6 }}
          />
          <div
            className={classes.dim}
            style={{
              insetBlockStart: box.top + box.height + 6,
              insetBlockEnd: 0,
            }}
          />
          <div
            className={classes.dim}
            style={{
              top: box.top - 6,
              height: box.height + 12,
              left: 0,
              width: Math.max(0, box.left - 6),
            }}
          />
          <div
            className={classes.dim}
            style={{
              top: box.top - 6,
              height: box.height + 12,
              left: box.left + box.width + 6,
              right: 0,
            }}
          />
          <div className={classes.highlight} style={highlight ?? undefined} aria-hidden />
        </>
      ) : (
        <div className={classes.dimFull} />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
        aria-describedby="tour-step-body"
        className={classes.card}
        style={cardStyle}
      >
        <div className={classes.head}>
          <p className={classes.eyebrow}>
            {tour.title} · Step {index + 1} of {tour.steps.length}
          </p>
          <button
            type="button"
            className={classes.close}
            onClick={() => close('dismissed')}
            aria-label="Close the tour"
          >
            <IconX size={16} stroke={1.75} aria-hidden />
          </button>
        </div>

        <h2 id="tour-step-title" ref={headingRef} tabIndex={-1} className={classes.title}>
          {step.title}
        </h2>
        <p id="tour-step-body" className={classes.body}>
          {step.body}
        </p>

        <div className={classes.progress} aria-hidden>
          {tour.steps.map((candidate, candidateIndex) => (
            <span
              key={candidate.id}
              className={classes.progressDot}
              data-done={candidateIndex <= index ? 'true' : undefined}
            />
          ))}
        </div>

        <div className={classes.actions}>
          <Button variant="subtle" size="xs" onClick={() => close('dismissed')}>
            Skip tour
          </Button>
          <div className={classes.actionsRight}>
            {!isFirst ? (
              <Button
                variant="default"
                size="xs"
                onClick={back}
                leftSection={<IconArrowLeft size={14} stroke={1.75} />}
              >
                Back
              </Button>
            ) : null}
            <Button
              size="xs"
              onClick={next}
              rightSection={!isLast ? <IconArrowRight size={14} stroke={1.75} /> : undefined}
            >
              {isLast ? 'Finish' : 'Next'}
            </Button>
          </div>
        </div>

        <span className={classes.srOnly} aria-live="polite">
          Step {index + 1} of {tour.steps.length}: {step.title}
        </span>
      </div>
    </div>,
    document.body,
  );
}

/** Exported for tests: the layout maths is the part worth pinning. */
export const __tourInternals = { tooltipPosition, prefersReducedMotion };
