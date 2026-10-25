import { IconBrandWhatsapp, IconExternalLink, IconLock, IconMail } from '@tabler/icons-react';
import { Surface } from '@/components/ui/Surface';
import type { ListingContactView } from '@/server/dto/listing.dto';
import classes from './ListingContactCard.module.css';

export interface ListingContactCardProps {
  contact: ListingContactView;
  /** The display name — the anonymous stand-in while identity is withheld. */
  listingName: string;
  /** True while the name and contact channels are still gated behind an enquiry. */
  hidden: boolean;
  /** Rendered under the channels, e.g. a response-time expectation. */
  footnote?: string;
}

/**
 * The identity panel in the profile's right rail.
 *
 * The product rule is that a visitor must send an enquiry before the trading
 * name and any contact channel are shown — the enquiry is what the marketplace
 * exists to capture, and a visible phone number turns the page into classifieds
 * with no attributable lead.
 *
 * So this card has exactly two states:
 *
 * - **withheld** (the default) — the anonymous name, a lock and an explanation
 *   of what unlocks it. No channel is rendered, and the server DTO carries no
 *   channel values to render (see `publicListingDetail`).
 * - **unlocked** — the real name and whichever channels the business chose to
 *   publish. A phone number is shown as plain text, never a `tel:` action, so it
 *   stays available without becoming the path of least resistance.
 *
 * A `null` channel is never invented: when every channel is withheld, or the
 * visitor has not enquired yet, the DTO's message explains why.
 */
export function ListingContactCard({
  contact,
  listingName,
  hidden,
  footnote,
}: ListingContactCardProps) {
  const hasChannel = Boolean(contact.phone || contact.email || contact.whatsapp || contact.website);

  return (
    <Surface tone="raised" padding="md" elevated className={classes.card}>
      {hidden ? (
        <>
          <h2 className={classes.heading}>
            <IconLock size="1rem" stroke={1.5} aria-hidden /> Contact details locked
          </h2>
          <p className={classes.lede}>
            {listingName} has not shared its name or contact channels with you yet. Send the enquiry
            just below and they appear here immediately — no account, no phone call.
          </p>
        </>
      ) : (
        <h2 className={classes.heading}>Contact {listingName}</h2>
      )}

      {footnote ? <p className={classes.footnote}>{footnote}</p> : null}

      {contact.message && !hidden ? <p className={classes.message}>{contact.message}</p> : null}

      {hasChannel ? (
        <dl className={classes.channels}>
          {contact.phone ? (
            <div className={classes.channel}>
              <dt className={classes.channelLabel}>Phone</dt>
              <dd className={classes.channelValue}>{contact.phone}</dd>
            </div>
          ) : null}

          {contact.email ? (
            <div className={classes.channel}>
              <dt className={classes.channelLabel}>
                <IconMail size="0.875rem" stroke={1.5} aria-hidden /> Email
              </dt>
              <dd className={classes.channelValue}>
                <a className={classes.link} href={`mailto:${contact.email}`}>
                  {contact.email}
                </a>
              </dd>
            </div>
          ) : null}

          {contact.whatsapp ? (
            <div className={classes.channel}>
              <dt className={classes.channelLabel}>
                <IconBrandWhatsapp size="0.875rem" stroke={1.5} aria-hidden /> WhatsApp
              </dt>
              <dd className={classes.channelValue}>
                <a
                  className={classes.link}
                  href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {contact.whatsapp}
                </a>
              </dd>
            </div>
          ) : null}

          {contact.website ? (
            <div className={classes.channel}>
              <dt className={classes.channelLabel}>
                <IconExternalLink size="0.875rem" stroke={1.5} aria-hidden /> Website
              </dt>
              <dd className={classes.channelValue}>
                <a
                  className={classes.link}
                  href={contact.website}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {contact.website}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      ) : !hidden ? (
        <p className={classes.message}>{contact.message ?? 'No contact channels published.'}</p>
      ) : null}
    </Surface>
  );
}
