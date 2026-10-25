'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import classes from './HomeHero.module.css';

/**
 * The frame-callback API is not in every TypeScript DOM lib yet, so the two
 * methods are typed locally instead of relying on the compiler's version.
 */
type FrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    callback: (now: number, metadata: { mediaTime: number }) => void,
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export interface HomeHeroMediaProps {
  /**
   * The background clip. It is a hosted asset (Cloudflare R2), so changing the
   * hero video means changing this URL in `src/app/page.tsx` — or replacing the
   * object in the bucket — not adding a file to `public/`.
   */
  videoSrc?: string;
  /** A still used as the poster and as the universal fallback. */
  posterSrc?: string;
  posterAlt?: string;
  /**
   * Play only the opening N seconds of the clip, then jump back to 0.
   *
   * The source runs for 12 seconds, but the part edited to loop seamlessly is
   * the first 9; letting the browser loop the whole file would play a transition
   * that was never meant to be seen. `0` (or no value) keeps native full-length
   * looping.
   */
  segmentEndSeconds?: number;
}

/**
 * The hero's background layer: a still that always paints, with the video
 * composited over it when the visitor's settings allow motion.
 *
 * Three decisions are load-bearing:
 *
 * 1. **The still is never removed.** It is the poster the `<video>` shows while
 *    the clip buffers, and it is what remains if the asset is missing, the codec
 *    is unsupported or playback errors — so the hero can never be an empty
 *    black rectangle because a request failed.
 * 2. **Reduced motion is respected by not mounting the video at all.** CSS can
 *    hide a video but not stop it, so a hidden clip would still decode and
 *    paint. Skipping the element is the only version that costs a motion-
 *    sensitive visitor nothing.
 * 3. **No pause control.** The clip is decorative and muted, which is the one
 *    case WCAG exempts from the pause requirement; it carries no information
 *    the headline and search form do not already state.
 */
export function HomeHeroMedia({
  videoSrc,
  posterSrc,
  posterAlt = '',
  segmentEndSeconds = 0,
}: HomeHeroMediaProps) {
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setMotionAllowed(!query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const showVideo = Boolean(videoSrc) && motionAllowed && !failed;

  /*
   * Crop the clip to the segment that was edited to loop.
   *
   * A `<video loop>` repeats the whole file, so a 12-second source yields a
   * 12-second cycle. To loop at 0:09 the playhead has to be moved back to zero
   * when it reaches the cut. Two details make that invisible:
   *
   * - the check runs on a video frame callback where available, so the jump
   *   lands on the frame after 9.000s rather than up to 250ms late (which is all
   *   `timeupdate` can promise);
   * - a `requestAnimationFrame` fallback covers browsers without the frame
   *   callback, still checking every paint rather than four times a second.
   *
   * `loop` stays on the element as the fallback for a source that is shorter
   * than the segment or whose duration is not known yet: native looping is then
   * already the correct behaviour.
   */
  useEffect(() => {
    const video = videoRef.current as FrameCallbackVideo | null;
    if (!video || !showVideo || segmentEndSeconds <= 0) return;

    let cancelled = false;
    let frameHandle: number | null = null;
    let rafHandle: number | null = null;

    const requestFrame = video.requestVideoFrameCallback?.bind(video);
    const cancelFrame = video.cancelVideoFrameCallback?.bind(video);

    const restart = () => {
      try {
        video.currentTime = 0;
      } catch {
        // Seeking before the media has metadata is a no-op, not a failure.
      }
      if (video.paused) void video.play().catch(() => undefined);
    };

    /** False while the duration is unknown, or when the clip is already shorter. */
    const segmentApplies = () => {
      const { duration } = video;
      return Number.isFinite(duration) && duration > segmentEndSeconds + 0.05;
    };

    const onFrame = () => {
      if (cancelled) return;
      if (segmentApplies() && video.currentTime >= segmentEndSeconds) restart();
      if (requestFrame) frameHandle = requestFrame(onFrame);
    };

    const tick = () => {
      if (cancelled) return;
      if (segmentApplies() && video.currentTime >= segmentEndSeconds) restart();
      rafHandle = window.requestAnimationFrame(tick);
    };

    if (requestFrame) {
      frameHandle = requestFrame(onFrame);
    } else {
      rafHandle = window.requestAnimationFrame(tick);
    }

    return () => {
      cancelled = true;
      if (frameHandle !== null) cancelFrame?.(frameHandle);
      if (rafHandle !== null) window.cancelAnimationFrame(rafHandle);
    };
  }, [showVideo, segmentEndSeconds]);

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
          ref={videoRef}
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
