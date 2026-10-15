'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { ActionIcon, Modal } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { MediaPlaceholder } from '@/components/ui/MediaPlaceholder';
import type { ListingCardMedia } from '@/server/dto/listing.dto';
import classes from './ListingGallery.module.css';

export interface ListingGalleryProps {
  gallery: readonly ListingCardMedia[];
  /** Used for the placeholder seed and the lightbox caption. */
  name: string;
}

/**
 * Gallery with a keyboard-accessible lightbox.
 *
 * Built from one large image plus a thumbnail grid, and a Mantine `Modal` for
 * the enlarged view — **Mantine 9 ships no Carousel** (`@mantine/carousel` is
 * not installed), so nothing is imported from one.
 *
 * Accessibility: every thumbnail is a real `<button>` naming what it opens, the
 * modal traps focus and closes on Escape (Mantine defaults, untouched), and
 * Left/Right arrows move between images while it is open. Decorative arrows are
 * `aria-hidden`; the controls carry their own labels.
 */
export function ListingGallery({ gallery, name }: ListingGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const count = gallery.length;

  const open = useCallback((index: number) => setActiveIndex(index), []);
  const close = useCallback(() => setActiveIndex(null), []);
  const step = useCallback(
    (delta: number) => {
      setActiveIndex((current) => {
        if (current === null) return current;
        return (current + delta + count) % count;
      });
    },
    [count],
  );

  useEffect(() => {
    if (activeIndex === null) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        step(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        step(-1);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, step]);

  const active = activeIndex === null ? null : gallery[activeIndex];

  if (count === 0) {
    return <MediaPlaceholder seed={name} ratio="16/9" label={`No photographs of ${name} yet`} />;
  }

  return (
    <>
      <div className={classes.hero}>
        <button
          type="button"
          className={classes.heroButton}
          onClick={() => open(0)}
          aria-label={`Open photo 1 of ${count} of ${name} at full size`}
        >
          <Image
            className={classes.heroImage}
            src={gallery[0].url}
            alt={gallery[0].alt}
            fill
            sizes="(max-width: 62em) 100vw, 760px"
            preload
            unoptimized={gallery[0].url.endsWith('.svg')}
          />
        </button>
      </div>

      {count > 1 ? (
        <ul className={classes.thumbList}>
          {gallery.slice(1, 9).map((media, index) => {
            const realIndex = index + 1;
            return (
              <li key={`${media.url}-${realIndex}`}>
                <button
                  type="button"
                  className={classes.thumbButton}
                  onClick={() => open(realIndex)}
                  aria-label={`Open photo ${realIndex + 1} of ${count}`}
                >
                  <Image
                    className={classes.thumbImage}
                    src={media.url}
                    alt=""
                    fill
                    sizes="120px"
                    unoptimized={media.url.endsWith('.svg')}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <Modal
        opened={activeIndex !== null}
        onClose={close}
        size="xl"
        padding="md"
        title={active?.alt ?? name}
        closeButtonProps={{ 'aria-label': 'Close photo viewer' }}
      >
        <div className={classes.lightbox}>
          {active ? (
            <Image
              className={classes.lightboxImage}
              src={active.url}
              alt={active.alt}
              fill
              sizes="(max-width: 62em) 100vw, 1100px"
              unoptimized={active.url.endsWith('.svg')}
            />
          ) : null}
        </div>

        {count > 1 ? (
          <div className={classes.lightboxControls}>
            <ActionIcon
              variant="default"
              size="lg"
              onClick={() => step(-1)}
              aria-label="Previous photo"
            >
              <IconChevronLeft size="1.25rem" stroke={1.5} aria-hidden />
            </ActionIcon>
            <p className={classes.lightboxCount} aria-live="polite">
              {(activeIndex ?? 0) + 1} of {count}
            </p>
            <ActionIcon variant="default" size="lg" onClick={() => step(1)} aria-label="Next photo">
              <IconChevronRight size="1.25rem" stroke={1.5} aria-hidden />
            </ActionIcon>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
