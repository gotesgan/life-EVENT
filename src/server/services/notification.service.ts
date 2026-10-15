import 'server-only';

export interface EnquiryCreatedNotification {
  enquiryId: string;
  referenceCode: string;
  customerName: string;
  customerEmail: string;
  listingNames: string[];
  eventDate: Date | null;
}

export interface EnquiryStatusNotification {
  enquiryId: string;
  referenceCode: string;
  customerEmail: string;
  listingName: string;
  status: string;
  customerVisibleMessage: string | null;
}

/**
 * Outbound notification seam.
 *
 * Email/SMS delivery is out of MVP scope, but enquiry creation must not be
 * coupled to how (or whether) a notification is delivered. Implementations are
 * called only *after* the database transaction commits and are wrapped so a
 * delivery failure can never fail or roll back a lead.
 */
export interface NotificationPort {
  enquiryCreated(payload: EnquiryCreatedNotification): Promise<void>;
  enquiryStatusChanged(payload: EnquiryStatusNotification): Promise<void>;
  adminLeadAssigned(payload: {
    enquiryId: string;
    referenceCode: string;
    assignedAdminId: string;
    listingName: string;
  }): Promise<void>;
}

export const noopNotificationPort: NotificationPort = {
  async enquiryCreated() {},
  async enquiryStatusChanged() {},
  async adminLeadAssigned() {},
};

let port: NotificationPort = noopNotificationPort;

export function getNotificationPort(): NotificationPort {
  return port;
}

/** Injection point for a real provider (email/SMS) or for tests. */
export function setNotificationPort(next: NotificationPort): void {
  port = next;
}

/**
 * Runs a notification without allowing it to affect the caller. A failure is
 * logged and swallowed: the lead is already committed and must not be lost
 * because a third-party provider is down.
 */
export async function sendNotification(
  send: (port: NotificationPort) => Promise<void>,
): Promise<void> {
  try {
    await send(getNotificationPort());
  } catch (error) {
    console.error('[notification] delivery failed', error);
  }
}
