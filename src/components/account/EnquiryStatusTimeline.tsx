import type { ReactNode } from 'react';
import {
  IconClock,
  IconMessage,
  IconPencil,
  IconRefresh,
  IconSend,
  IconShare,
  IconX,
} from '@tabler/icons-react';
import { StatusBadge, cx } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import type { CustomerTimelineEntry } from '@/server/dto/enquiry.dto';
import classes from './EnquiryStatusTimeline.module.css';

/**
 * Human labels for the activity types a customer can see.
 *
 * The DTO already filters to `isCustomerVisible` rows, so an unmapped type can
 * only be a new customer-visible activity — it falls back to a readable form of
 * the raw code rather than showing the code itself.
 */
const TYPE_LABELS: Record<string, string> = {
  CREATED: 'Enquiry received',
  STATUS_CHANGED: 'Progress updated',
  CONTACT_DISCLOSED: 'Contact details shared',
  PROVIDER_RESPONSE_RECORDED: 'Reply recorded',
  CUSTOMER_UPDATED: 'Enquiry updated',
  CANCELLED_BY_CUSTOMER: 'Cancelled by you',
};

/**
 * A glyph per activity type.
 *
 * Order is the meaning in this list, so the icon is not decoration — it is what
 * makes a row scannable at 13px without reading it, and it gives the entry a
 * second channel beside its tone (WCAG 1.4.1).
 */
const TYPE_ICONS: Record<string, ReactNode> = {
  CREATED: <IconSend size="0.75rem" stroke={1.8} />,
  STATUS_CHANGED: <IconRefresh size="0.75rem" stroke={1.8} />,
  CONTACT_DISCLOSED: <IconShare size="0.75rem" stroke={1.8} />,
  PROVIDER_RESPONSE_RECORDED: <IconMessage size="0.75rem" stroke={1.8} />,
  CUSTOMER_UPDATED: <IconPencil size="0.75rem" stroke={1.8} />,
  CANCELLED_BY_CUSTOMER: <IconX size="0.75rem" stroke={1.8} />,
};

function typeLabel(type: string): string {
  const known = TYPE_LABELS[type];
  if (known) return known;
  const words = type.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface EnquiryStatusTimelineProps {
  entries: readonly CustomerTimelineEntry[];
}

/**
 * The customer-visible history of one enquiry.
 *
 * Plain semantic `<ol>` markup rather than a component-library stepper: the
 * order is the meaning, so the list element carries it, and there is no
 * interactive state to trap focus in. The most recent entry is the enquiry's
 * current position, so it is the only one drawn solid and the only one labelled
 * "Latest" — sequencing furniture, because a timeline really is a sequence.
 */
export function EnquiryStatusTimeline({ entries }: EnquiryStatusTimelineProps) {
  if (entries.length === 0) {
    return (
      <p className={classes.empty}>
        Nothing has been recorded on this enquiry yet. Updates appear here as the businesses
        respond.
      </p>
    );
  }

  const lastIndex = entries.length - 1;

  return (
    <ol className={classes.list}>
      {entries.map((entry, index) => {
        const isLatest = index === lastIndex;
        return (
          <li key={entry.id} className={classes.item}>
            <span aria-hidden className={cx(classes.marker, isLatest && classes.markerLatest)}>
              {TYPE_ICONS[entry.type] ?? <IconClock size="0.75rem" stroke={1.8} />}
            </span>
            <div className={classes.body}>
              <p className={classes.heading}>
                <span className={classes.type}>{typeLabel(entry.type)}</span>
                {entry.listingName ? (
                  <span className={classes.listing}>{entry.listingName}</span>
                ) : null}
                {isLatest ? (
                  <StatusBadge tone="neutral" variant="outline" size="sm">
                    Latest
                  </StatusBadge>
                ) : null}
              </p>
              {entry.message ? <p className={classes.message}>{entry.message}</p> : null}
              <p className={classes.time}>
                <time dateTime={entry.at.toISOString()}>{formatDateTime(entry.at)}</time>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
