import type { Metadata } from 'next';
import Image from 'next/image';
import Link from '@/components/ui/ClientLink';
import { PageSection } from '@/components/layout/PageSection';
import { SiteShell } from '@/components/layout/SiteShell';
import { Button, Container, PageHeader } from '@/components/ui';
import { TEAM_MEMBERS } from '@/lib/team';
import classes from './page.module.css';

export const metadata: Metadata = {
  title: 'The team',
  description:
    'Meet the small leadership team behind Life Events: Pratik Nachare, Ravindra Bohara and Jyoti Solanke, and the standard the catalogue is held to.',
  alternates: { canonical: '/team' },
};

const PRINCIPLES: readonly { title: string; body: string }[] = [
  {
    title: 'Published, not guessed',
    body: 'Every price, capacity and inclusion comes from the business. Nothing is estimated or filled in on its behalf.',
  },
  {
    title: 'One enquiry, not ten calls',
    body: 'Describe the event once, send it to the businesses you choose, and follow every reply with one reference code.',
  },
  {
    title: 'A person checks the work',
    body: 'New businesses are reviewed before a listing goes live. The catalogue is maintained by the same team that answers for it.',
  },
];

export default function TeamPage() {
  return (
    <SiteShell>
      <Container className="surface--editorial">
        <PageHeader
          eyebrow="The team"
          title="The people behind Life Events"
          description="A small leadership team, one standard for the catalogue, and a product built to be read rather than sold to."
          breadcrumbs={[
            { label: 'Home', href: '/' },
            { label: 'About', href: '/about' },
            { label: 'Team' },
          ]}
        />

        <PageSection
          id="leadership"
          title="Leadership"
          description="The people who set the standard, answer for it, and still review the listings themselves."
        >
          <ul className={classes.grid}>
            {TEAM_MEMBERS.map((member, index) => (
              <li key={member.slug} className={classes.member}>
                <figure className={classes.figure}>
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

                  <figcaption>
                    <div className={classes.meta}>
                      <span className={classes.index} aria-hidden>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className={classes.role}>{member.role}</span>
                    </div>
                    <h3 className={classes.name}>{member.name}</h3>
                    <p className={classes.focus}>{member.focus}</p>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </PageSection>
      </Container>

      {/*
       * The standard is a full-bleed band rather than another card: the page has
       * just shown three portraits, so the values need a change of ground to read
       * as a statement instead of a continuation of the team grid.
       */}
      <section className={classes.standard} aria-labelledby="standard-heading">
        <Container>
          <div className={classes.standardGrid}>
            <div className={classes.standardIntro}>
              <p className={classes.eyebrow}>Our standard</p>
              <h2 id="standard-heading" className={classes.standardTitle}>
                A price on the page, or no claim at all.
              </h2>
              <p className={classes.standardBody}>
                Trust in a marketplace is built by what it refuses to invent. No guessed prices, no
                invented ratings, no borrowed photographs. If a business has not published a detail,
                we do not fill it in for them.
              </p>
            </div>

            <ol className={classes.principles}>
              {PRINCIPLES.map((principle, index) => (
                <li key={principle.title} className={classes.principle}>
                  <span className={classes.principleIndex} aria-hidden>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className={classes.principleTitle}>{principle.title}</h3>
                    <p className={classes.principleBody}>{principle.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      <Container className="surface--editorial">
        <section className={classes.cta} aria-labelledby="work-with-us-heading">
          <div className={classes.ctaText}>
            <p className={classes.eyebrow}>Work with us</p>
            <h2 id="work-with-us-heading" className={classes.ctaTitle}>
              If you run an event business, we should talk.
            </h2>
            <p className={classes.ctaBody}>
              Tell us what you do and where you work. The team reviews every application before a
              listing is published.
            </p>
          </div>

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
    </SiteShell>
  );
}
