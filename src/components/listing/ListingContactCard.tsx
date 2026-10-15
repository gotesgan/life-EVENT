import Link from '@/components/ui/ClientLink';
import { Button } from '@mantine/core';
import { IconBrandWhatsapp, IconExternalLink, IconMail, IconSend } from '@tabler/icons-react';
import { Surface } from '@/components/ui/Surface';
import { parseQuery, readSelectedListings } from '@/lib/filter-state';
import type { ListingContactView } from '@/server/dto/listing.dto';
import { AddToEnquiryButton, EnquirySubmitButton } from './EnquiryShortlist';
import classes from './ListingContactCard.module.css';

/**
 * The slug this card is about, read back out of the enquiry URL it is handed.
 *
 * The profile page owns that URL (`/enquire?enquire=<slug>`) and belongs to
 * another workstream, so the card recovers the one slug it points at instead of
 * asking the page for a new prop. It is `null` only when the URL is not an
 * enquiry URL, in which case the card falls back to the plain link.
 */
function shortlistSlugFrom(enquiryHref: string): string | null {
  const queryStart = enquiryHref.indexOf('?');
  if (queryStart === -1) return null;
  return readSelectedListings(parseQuery(enquiryHref.slice(queryStart + 1)))[0] ?? null;
}

export interface ListingContactCardProps {
  contact: ListingContactView;
  listingName: string;
  enquiryHref: string;
  /** Rendered under the CTA, e.g. a response-time expectation. */
  footnote?: string;
}

/**
 * The contact panel and the profile's primary action.
 *
 * The primary action is deliberately **"Send an enquiry"**, never a phone link:
 * the competitor research is explicit that a click-to-call CTA destroys lead
 * attribution and turns a marketplace into classifieds. Where a business has
 * chosen to publish a phone number it is shown as plain text (not a clickable
 * `tel:` action) beneath the enquiry button, so the number is available without
 * becoming the path of least resistance. A `null` channel is never invented —
 * when every channel is withheld, the DTO's message explains why and the
 * enquiry button is the only action.
 *
 * The button now carries the visitor's whole shortlist, and the secondary
 * control adds this business to it, so contacting from here no longer wipes an
 * earlier selection — see `EnquiryShortlist`.
 */
export function ListingContactCard({
  contact,
  listingName,
  enquiryHref,
  footnote,
}: ListingContactCardProps) {
  const hasChannel = Boolean(contact.phone || contact.email || contact.whatsapp || contact.website);
  const slug = shortlistSlugFrom(enquiryHref);

  return (
    <Surface tone="raised" padding="md" elevated className={classes.card}>
      <h2 className={classes.heading}>Contact {listingName}</h2>

      <p className={classes.lede}>
        Send one enquiry and the business replies to you directly. Your details are shared only with
        the businesses you choose.
      </p>

      {slug ? (
        <EnquirySubmitButton slug={slug} />
      ) : (
        <Button
          component={Link}
          href={enquiryHref}
          fullWidth
          leftSection={<IconSend size="1rem" stroke={1.5} aria-hidden />}
        >
          Send an enquiry
        </Button>
      )}

      {/* Adding from here no longer replaces an earlier selection: the shortlist
          is carried into the enquiry link above. */}
      {slug ? <AddToEnquiryButton slug={slug} name={listingName} /> : null}

      {footnote ? <p className={classes.footnote}>{footnote}</p> : null}

      {contact.message ? <p className={classes.message}>{contact.message}</p> : null}

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
      ) : null}
    </Surface>
  );
}
