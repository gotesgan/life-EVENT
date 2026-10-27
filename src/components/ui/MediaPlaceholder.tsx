import { cx } from './cx';
import classes from './MediaPlaceholder.module.css';

/** The only four ratios the system allows. One ratio per grid, never mixed. */
export type MediaRatio = '3/2' | '4/3' | '1/1' | '16/9';

export interface MediaPlaceholderProps {
  /** Any stable string — a listing slug or name. Same seed, same motif. */
  seed: string;
  ratio?: MediaRatio;
  /** Overrides the default accessible name. */
  label?: string;
  className?: string;
}

const VIEWBOX: Record<MediaRatio, readonly [number, number]> = {
  '3/2': [150, 100],
  '4/3': [160, 120],
  '1/1': [120, 120],
  '16/9': [160, 90],
};

const RATIO_CLASS: Record<MediaRatio, string> = {
  '3/2': classes.r3x2,
  '4/3': classes.r4x3,
  '1/1': classes.r1x1,
  '16/9': classes.r16x9,
};

/** Ink, vermilion, success green, ochre — never danger; a placeholder is not an error. */
const MOTIF_TONES = [
  'var(--app-brand)',
  'var(--app-accent)',
  'var(--app-success)',
  'var(--app-warning)',
] as const;

const BRASS = 'var(--app-accent)';

/** FNV-1a: small, allocation-free and identical on server and client. */
function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

/** mulberry32 — deterministic PRNG, so a seed always yields the same drawing. */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface MotifProps {
  seed: string;
  width: number;
  height: number;
}

/**
 * Four compositions, chosen deterministically from the seed. All of them are
 * built from a single `currentColor` plus one accent element, so any motif works
 * on any surface in either scheme.
 */
function Motif({ seed, width, height }: MotifProps) {
  const hash = hashSeed(seed);
  const variant = hash % 4;
  const random = createRandom(hash);

  if (variant === 0) {
    /* Arc fan: rings radiating from a point below the frame. */
    const cx = width * (0.34 + random() * 0.32);
    const cy = height * (0.88 + random() * 0.2);
    return (
      <>
        {[0, 1, 2, 3].map((ring) => (
          <circle
            key={ring}
            cx={cx}
            cy={cy}
            r={height * (0.26 + ring * 0.17)}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.4 - ring * 0.08}
            strokeWidth={2}
          />
        ))}
        <circle cx={width * 0.78} cy={height * 0.24} r={height * 0.05} fill={BRASS} />
      </>
    );
  }

  if (variant === 1) {
    /* Nested arches — the same form as the brand mark. */
    const cx = width / 2;
    const baseY = height * 0.96;
    const centreY = height * 0.66;
    const outerRadius = width * 0.3;
    return (
      <>
        {[0, 1, 2].map((ring) => {
          const radius = outerRadius * (1 - ring * 0.26);
          return (
            <path
              key={ring}
              d={`M${cx - radius} ${baseY} V${centreY} a${radius} ${radius} 0 0 1 ${radius * 2} 0 V${baseY}`}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.46 - ring * 0.1}
              strokeWidth={2}
            />
          );
        })}
        <circle cx={cx} cy={centreY - outerRadius * 0.82} r={height * 0.05} fill={BRASS} />
      </>
    );
  }

  if (variant === 2) {
    /* Dot matrix with one softened disc bleeding out of a corner. */
    const columns = 7;
    const rows = Math.max(3, Math.round((height / width) * columns));
    const stepX = width / (columns + 1);
    const stepY = height / (rows + 1);
    const discRadius = height * (0.5 + random() * 0.2);
    const fromLeft = random() > 0.5;
    const fromTop = random() > 0.5;

    const dots: Array<{ row: number; column: number }> = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        dots.push({ row, column });
      }
    }

    return (
      <>
        <circle
          cx={fromLeft ? -discRadius * 0.36 : width + discRadius * 0.36}
          cy={fromTop ? -discRadius * 0.36 : height + discRadius * 0.36}
          r={discRadius}
          fill="currentColor"
          fillOpacity={0.14}
        />
        {dots.map(({ row, column }) => (
          <circle
            key={`${row}-${column}`}
            cx={stepX * (column + 1)}
            cy={stepY * (row + 1)}
            r={Math.min(stepX, stepY) * 0.12}
            fill="currentColor"
            fillOpacity={0.42}
          />
        ))}
      </>
    );
  }

  /* Diagonal rules crossed by a ring. */
  const ringX = width * (0.6 + random() * 0.15);
  const ringY = height * (0.34 + random() * 0.22);
  const ringRadius = height * (0.2 + random() * 0.08);
  return (
    <>
      <g transform={`rotate(-18 ${width / 2} ${height / 2})`} stroke="currentColor" strokeWidth={2}>
        <line
          x1={-width}
          y1={height * 0.34}
          x2={width * 2}
          y2={height * 0.34}
          strokeOpacity={0.36}
        />
        <line
          x1={-width}
          y1={height * 0.56}
          x2={width * 2}
          y2={height * 0.56}
          strokeOpacity={0.24}
        />
        <line
          x1={-width}
          y1={height * 0.78}
          x2={width * 2}
          y2={height * 0.78}
          strokeOpacity={0.15}
        />
      </g>
      <circle
        cx={ringX}
        cy={ringY}
        r={ringRadius}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.52}
        strokeWidth={2}
      />
      <circle cx={width * 0.2} cy={height * 0.78} r={height * 0.05} fill={BRASS} />
    </>
  );
}

/**
 * A designed stand-in for a listing with no photograph.
 *
 * The competitor research found galleries and grids dominated by blank or
 * broken placeholder tiles. This does the opposite: the motif is derived
 * deterministically from `seed`, so the same listing keeps the same drawing
 * across renders and between server and client, and a grid of photo-less
 * listings reads as a set of distinct objects rather than a wall of grey.
 *
 * `role="img"` with an `aria-label` means assistive technology announces it as
 * media, not as a decorative empty box.
 */
export function MediaPlaceholder({ seed, ratio = '3/2', label, className }: MediaPlaceholderProps) {
  const [width, height] = VIEWBOX[ratio];
  const hash = hashSeed(seed);
  const tone = MOTIF_TONES[(hash >>> 8) % MOTIF_TONES.length];

  return (
    <div className={cx(classes.root, RATIO_CLASS[ratio], className)}>
      <svg
        className={classes.svg}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={label ?? `No photograph available for ${seed}`}
      >
        <rect x="0" y="0" width={width} height={height} fill="var(--app-surface-muted)" />
        <g style={{ color: tone }}>
          <Motif seed={seed} width={width} height={height} />
        </g>
      </svg>
    </div>
  );
}
