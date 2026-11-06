import type { Metadata } from 'next';
import Image from 'next/image';
import Link from '@/components/ui/ClientLink';
import { SiteShell } from '@/components/layout/SiteShell';
import { Button, Container } from '@/components/ui';
import { TEAM_MEMBERS } from '@/lib/team';
import classes from './page.module.css';

export const metadata: Metadata = {
  title: 'Meet our team',
  description: 'Meet the team behind Life Events.',
  alternates: { canonical: '/team' },
};

export default function TeamPage() {
  return (
    <SiteShell>
      {/* The page is set in the UI face end to end — see `.page` in the CSS module. */}
      <div className={classes.page}>
        <Container>
          <header className={classes.hero}>
            <h1 className={classes.title}>Meet our team</h1>
          </header>

          <ul className={classes.grid}>
            {TEAM_MEMBERS.map((member, index) => (
              <li key={member.slug} className={classes.member}>
                <figure className={classes.card}>
                  <div className={classes.media}>
                    <Image
                      className={classes.image}
                      src={member.image.src}
                      alt={member.image.alt}
                      fill
                      sizes="(min-width: 768px) 31vw, 92vw"
                      preload={index === 0}
                    />
                  </div>

                  <figcaption className={classes.caption}>
                    <h2 className={classes.name}>{member.name}</h2>
                    <p className={classes.role}>{member.role}</p>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </Container>

        <Container>
          <section className={classes.cta} aria-labelledby="work-with-us-heading">
            <h2 id="work-with-us-heading" className={classes.ctaTitle}>
              If you run an event business, we should talk.
            </h2>

            <div className={classes.actions}>
              <Button component={Link} href="/partner-with-us" size="md">
                List your business
              </Button>
              <Button component={Link} href="/contact" variant="secondary" size="md">
                Contact us
              </Button>
            </div>
          </section>
        </Container>
      </div>
    </SiteShell>
  );
}
