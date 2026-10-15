import { StatusBadge } from '@/components/ui/StatusBadge';

export interface VerifiedBadgeProps {
  /** Only render for a verified listing; returns `null` otherwise. */
  isVerified: boolean;
  size?: 'sm' | 'md';
}

/**
 * The verification marker.
 *
 * Verification is an administrator-set state backed by the listing's
 * `verificationStatus`, so this badge is a statement about data the platform
 * actually holds — not a paid ribbon. It is never the only signal: the listing
 * detail page states what verification means in words.
 */
export function VerifiedBadge({ isVerified, size = 'sm' }: VerifiedBadgeProps) {
  if (!isVerified) return null;

  return (
    <StatusBadge tone="success" variant="soft" size={size} dot>
      Verified
    </StatusBadge>
  );
}
