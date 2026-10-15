import { StatusBadge, type StatusSize, type StatusTone, type StatusVariant } from '@/components/ui';
import type { CustomerEnquirySummary } from '@/server/dto/enquiry.dto';

/**
 * Customer-facing status pill.
 *
 * The label always comes from the DTO (`statusLabel`), which is the reviewed
 * customer wording — the internal operational vocabulary is never used here. The
 * badge only decides *tone* and *variant*, and the dot means colour is not the
 * sole carrier of meaning.
 *
 * Tones follow the guide's lead-status mapping (marketplace-styling-guide §6.4):
 * status is never the action colour, "in progress" is neutral rather than
 * celebratory, and only a terminal good state earns a solid fill.
 */
const TONES: Record<CustomerEnquirySummary['status'], StatusTone> = {
  NEW: 'accent',
  CONTACTED: 'neutral',
  QUALIFIED: 'success',
  SHARED_WITH_PROVIDER: 'success',
  CONVERTED: 'success',
  LOST: 'danger',
  CANCELLED: 'neutral',
  DUPLICATE: 'neutral',
  SPAM: 'neutral',
};

/** Only a finished, successful outcome is loud enough for a solid fill. */
const SOLID: ReadonlySet<string> = new Set(['CONVERTED']);

/**
 * Resolves a status code to its tone.
 *
 * The guest tracking response carries the status as a plain string rather than
 * the DTO's union, so an unknown code has to resolve to something — `neutral`
 * is the honest answer, because a tone cannot be invented for a state the UI
 * does not know.
 */
export function enquiryStatusTone(status: string): StatusTone {
  return TONES[status as CustomerEnquirySummary['status']] ?? 'neutral';
}

export function enquiryStatusVariant(status: string): StatusVariant {
  return SOLID.has(status) ? 'solid' : 'soft';
}

export interface EnquiryStatusBadgeProps {
  status: CustomerEnquirySummary['status'];
  label: string;
  size?: StatusSize;
}

export function EnquiryStatusBadge({ status, label, size = 'sm' }: EnquiryStatusBadgeProps) {
  return (
    <StatusBadge
      tone={enquiryStatusTone(status)}
      variant={enquiryStatusVariant(status)}
      size={size}
      dot
    >
      {label}
    </StatusBadge>
  );
}
