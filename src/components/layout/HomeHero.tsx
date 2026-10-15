import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from '@/components/ui/ClientLink';
import { IconCheck } from '@tabler/icons-react';
import { Container } from '@/components/ui/Container';
import classes from './HomeHero.module.css';

export interface HomeHeroProps {
  title: string;
  lede: string;
  /** Short, verifiable product facts — no invented metrics. */
  facts?: readonly string[];
  /** Full-bleed background photo, like the WedMeGood-style reference. */
  imageUrl?: string;
  imageAlt?: string;
  popularSearches?: ReadonlyArray<{ label: string; href: string }>;
  children?: ReactNode;
}

/**
 * The homepage hero — full-bleed photo with a dark overlay, centred white
 * headline, and the search form in a white card (see reference screenshots).
 */
export function HomeHero({
  title,
  lede,
  facts,
  imageUrl,
  imageAlt = '',
  popularSearches,
  children,
}: HomeHeroProps) {
  return (
    <section className={classes.hero} aria-labelledby="home-hero-title">
      {imageUrl ? (
        <>
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            priority
            sizes="100vw"
            className={classes.photo}
          />
          <span aria-hidden className={classes.overlay} />
        </>
      ) : (
        <span aria-hidden className={classes.glow} />
      )}
      <Container>
        <div className={classes.inner}>
          <h1 id="home-hero-title" className={classes.title}>
            {title}
          </h1>
          <p className={classes.lede}>{lede}</p>

          {facts && facts.length > 0 ? (
            <ul className={classes.facts}>
              {facts.map((fact) => (
                <li key={fact} className={classes.fact}>
                  <IconCheck className={classes.factIcon} size="1rem" stroke={1.5} aria-hidden />
                  {fact}
                </li>
              ))}
            </ul>
          ) : null}

          {children ? <div className={classes.searchCard}>{children}</div> : null}

          {popularSearches && popularSearches.length > 0 ? (
            <p className={classes.popular}>
              <span className={classes.popularLabel}>Popular:</span>{' '}
              {popularSearches.map((item, index) => (
                <span key={item.href}>
                  {index > 0 ? <span aria-hidden>{' · '}</span> : null}
                  <Link href={item.href} className={classes.popularLink}>
                    {item.label}
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
