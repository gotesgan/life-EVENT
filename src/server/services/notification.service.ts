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

/**
 * The installed port, if a caller (or a test) has set one.
 *
 * When nothing has been installed, `sendNotification` lazily loads the email
 * implementation. Doing it lazily rather than wiring it in `instrumentation.ts`
 * matters: instrumentation is compiled into its own module graph, so assigning a
 * singleton there did not affect the instances the route handlers use, and
 * enquiry notifications silently stayed on the no-op port. The dynamic import
 * keeps `prisma` and the settings service out of every module that merely
 * imports the notification seam.
 */
let port: NotificationPort | null = null;
let emailPort: NotificationPort | null = null;

export function getNotificationPort(): NotificationPort | null {
  return port ?? emailPort;
}

async function resolveNotificationPort(): Promise<NotificationPort> {
  if (port) return port;
  if (!emailPort) {
    const { createEmailNotificationPort } = await import('./email-notification.port');
    emailPort = createEmailNotificationPort();
  }
  return emailPort;
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
    await send(await resolveNotificationPort());
  } catch (error) {
    console.error('[notification] delivery failed', error);
  }
}
