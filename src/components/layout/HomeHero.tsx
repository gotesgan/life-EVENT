import type { ReactNode } from 'react';
import Link from '@/components/ui/ClientLink';
import { HomeHeroMedia } from './HomeHeroMedia';
import classes from './HomeHero.module.css';

export interface HomeHeroProps {
  title: string;
  lede: string;
  /** Short, verifiable product facts, set as the tracked-out line above the title. */
  facts?: readonly string[];
  /** Background photo, used as the poster and as the universal fallback. */
  imageUrl?: string;
  imageAlt?: string;
  /**
   * Optional looping background clip. It sits above the still and falls back to
   * it wherever motion is unwelcome or the file cannot play.
   */
  videoUrl?: string;
  /**
   * Play only the opening N seconds of the clip, then loop back to the start.
   * Omit it to loop the whole file.
   */
  videoSegmentEndSeconds?: number;
  popularSearches?: ReadonlyArray<{ label: string; href: string }>;
  children?: ReactNode;
}

/**
 * The homepage hero: a framed, cinematic stage.
 *
 * The composition follows the reference the brief asked for — a dark band, a
 * video inset inside a thin frame rather than bleeding under the header, a
 * tracked-out micro-line above a centred display headline, and one quiet link
 * line at the foot of the frame. The search console stays, as a plain white
 * rectangle inside the frame: it is the one interactive object, and it should
 * read as a control rather than as another card in a stack.
 *
 * The stage is dark in both colour schemes (it is a band of film, not a themed
 * surface), so every text layer uses the on-dark ramp and no rule here flips with
 * theme. When there is no video or photo, the same dark stage remains: it is a
 * designed empty state, not a light-on-dark accident.
 */
export function HomeHero({
  title,
  lede,
  facts,
  imageUrl,
  imageAlt = '',
  videoUrl,
  videoSegmentEndSeconds,
  popularSearches,
  children,
}: HomeHeroProps) {
  return (
    <section className={classes.hero} aria-labelledby="home-hero-title">
      <div className={classes.stage}>
        {imageUrl || videoUrl ? (
          <>
            <HomeHeroMedia
              videoSrc={videoUrl}
              posterSrc={imageUrl}
              posterAlt={imageAlt}
              segmentEndSeconds={videoSegmentEndSeconds}
            />
            <span aria-hidden className={classes.overlay} />
          </>
        ) : null}

        <div className={classes.content}>
          {facts && facts.length > 0 ? (
            <ul className={classes.facts}>
              {facts.map((fact) => (
                <li key={fact} className={classes.fact}>
                  {fact}
                </li>
              ))}
            </ul>
          ) : null}

          <h1 id="home-hero-title" className={classes.title}>
            {title}
          </h1>
          <p className={classes.lede}>{lede}</p>

          {children ? <div className={classes.searchCard}>{children}</div> : null}
        </div>

        {popularSearches && popularSearches.length > 0 ? (
          <p className={classes.popular}>
            <span className={classes.popularLabel}>Popular</span>
            {popularSearches.map((item) => (
              <span key={item.href} className={classes.popularItem}>
                <span aria-hidden className={classes.dot}>
                  ·
                </span>
                <Link href={item.href} className={classes.popularLink}>
                  {item.label}
                </Link>
              </span>
            ))}
          </p>
        ) : null}
      </div>
    </section>
  );
}
