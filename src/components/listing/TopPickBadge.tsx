import { StatusBadge } from '@/components/ui/StatusBadge';

export interface TopPickBadgeProps {
  /**
   * Renders only when the listing carries the administrator-set
   * `verificationStatus` the platform uses to curate its picks; returns `null`
   * otherwise.
   */
  isVerified: boolean;
  size?: 'sm' | 'md';
}

/**
 * The "Top pick" marker.
 *
 * It shows on listings the platform has chosen to highlight. That selection is
 * an administrator-set state backed by the listing's `verificationStatus`, and
 * the wording is deliberately editorial: it is a curation, not a quality score,
 * a paid ribbon, or a guarantee. The About and Terms pages say so in words.
 */
export function TopPickBadge({ isVerified, size = 'sm' }: TopPickBadgeProps) {
  if (!isVerified) return null;

  return (
    <StatusBadge tone="success" variant="soft" size={size} dot>
      Top pick
    </StatusBadge>
  );
}
