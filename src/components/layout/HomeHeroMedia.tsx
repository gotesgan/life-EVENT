'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import classes from './HomeHero.module.css';

export interface HomeHeroMediaProps {
  /**
   * The looping background clip. Swapping the hero video is a file operation —
   * drop the new MP4 at `public/media/video/hero.mp4` — not a code change.
   */
  videoSrc?: string;
  /** A still used as the poster and as the universal fallback. */
  posterSrc?: string;
  posterAlt?: string;
}

/**
 * The hero's background layer: a still that always paints, with the video
 * composited over it when the visitor's settings allow motion.
 *
 * Three decisions are load-bearing:
 *
 * 1. **The still is never removed.** It is the poster the `<video>` shows while
 *    the clip buffers, and it is what remains if the file is missing, the codec
 *    is unsupported or playback errors — so the hero can never be an empty
 *    black rectangle because an asset 404'd.
 * 2. **Reduced motion is respected by not mounting the video at all.** CSS can
 *    hide a video but not stop it, so a hidden clip would still decode and
 *    paint. Skipping the element is the only version that costs a motion-
 *    sensitive visitor nothing.
 * 3. **No pause control.** The clip is decorative and muted, which is the one
 *    case WCAG exempts from the pause requirement; it carries no information
 *    the headline and search form do not already state.
 */
export function HomeHeroMedia({ videoSrc, posterSrc, posterAlt = '' }: HomeHeroMediaProps) {
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setMotionAllowed(!query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const showVideo = Boolean(videoSrc) && motionAllowed && !failed;

  return (
    <>
      {posterSrc ? (
        <Image
          src={posterSrc}
          alt={posterAlt}
          fill
          priority
          sizes="100vw"
          className={classes.photo}
        />
      ) : null}

      {showVideo ? (
        <video
          className={`${classes.photo} ${classes.video}`}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={posterSrc}
          aria-hidden
          tabIndex={-1}
          onError={() => setFailed(true)}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      ) : null}
    </>
  );
}
