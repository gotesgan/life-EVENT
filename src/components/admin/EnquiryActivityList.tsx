import { Text } from '@mantine/core';
import { StatusBadge } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import type { AdminEnquiryDetail } from '@/server/dto/enquiry.dto';
import { ENQUIRY_ACTIVITY_LABELS, ENQUIRY_LABELS, labelFor } from './status';
import classes from './Enquiries.module.css';

export interface EnquiryActivityListProps {
  activities: AdminEnquiryDetail['activities'];
}

/**
 * The lead's full history.
 *
 * Customer-visible and internal entries are distinguished by more than colour:
 * the visible ones carry a labelled badge and a left rule in the success tone,
 * so the two are still separable in a monochrome screenshot or to a
 * colour-blind reader. This is a deliberate presentation of the
 * `isCustomerVisible` flag and never a re-derivation of it.
 */
export function EnquiryActivityList({ activities }: EnquiryActivityListProps) {
  if (activities.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No activity recorded yet.
      </Text>
    );
  }

  return (
    <ol className={classes.activityList}>
      {activities.map((activity) => (
        <li
          key={activity.id}
          className={
            activity.isCustomerVisible
              ? `${classes.activityItem} ${classes.activityItemCustomer}`
              : classes.activityItem
          }
        >
          <div className={classes.activityMeta}>
            {/*
              The badge names the audience in words. The leading rule and the
              tone are the second and third channels, so this still reads
              correctly for a colour-blind administrator and in a greyscale
              screenshot.
            */}
            <StatusBadge tone={activity.isCustomerVisible ? 'success' : 'neutral'} size="sm" dot>
              {activity.isCustomerVisible ? 'Customer visible' : 'Internal only'}
            </StatusBadge>
            <Text component="span" size="xs" fw={650}>
              {labelFor(ENQUIRY_ACTIVITY_LABELS, activity.type)}
            </Text>
            <Text
              component="span"
              size="xs"
              className={classes.noteTimestamp}
              title={formatDateTime(activity.at) ?? undefined}
            >
              {formatDateTime(activity.at) ?? '—'}
            </Text>
            <Text component="span" size="xs" c="dimmed">
              · {activity.actorName ?? 'System'}
            </Text>
            {activity.listingName ? (
              <Text component="span" size="xs" c="dimmed" title={activity.listingName}>
                · {activity.listingName}
              </Text>
            ) : null}
          </div>

          {activity.fromStatus || activity.toStatus ? (
            <Text size="xs" c="dimmed" mt={4}>
              {labelFor(ENQUIRY_LABELS, activity.fromStatus)} →{' '}
              {labelFor(ENQUIRY_LABELS, activity.toStatus)}
            </Text>
          ) : null}

          {activity.message ? (
            <Text size="sm" className={classes.noteBody} mt={4}>
              {activity.message}
            </Text>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
