import 'server-only';
import { prisma } from '@/lib/db';
import { getAdminUrl, getAppUrl, getServerEnv } from '@/lib/env';
import type { NotificationPort } from './notification.service';
import { sendEmail } from './email.service';
import {
  adminNewEnquiryEmail,
  enquiryConfirmationEmail,
  enquiryStatusEmail,
  vendorApplicationDecisionEmail,
  vendorInviteEmail,
} from './email-templates';

/**
 * The email implementation of the notification seam.
 *
 * Installed by `instrumentation.ts` after configuration has validated, so the
 * service layer stays unaware of the transport. Recipients are resolved here:
 * the customer for customer-facing mail, and the active administrators (plus
 * `ADMIN_NOTIFICATION_EMAIL`) for operational mail.
 *
 * Every function is fire-and-forget safe: `sendEmail` records failures and never
 * throws, so a provider outage cannot fail an enquiry or an invite.
 */
async function adminRecipients(): Promise<string[]> {
  const env = getServerEnv();
  const recipients = new Set<string>();

  if (env.ADMIN_NOTIFICATION_EMAIL) recipients.add(env.ADMIN_NOTIFICATION_EMAIL);

  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { email: true },
      take: 10,
    });
    for (const admin of admins) {
      if (admin.email) recipients.add(admin.email);
    }
  } catch {
    // Degrade to the configured address only.
  }

  return [...recipients];
}

export function createEmailNotificationPort(): NotificationPort {
  const adminBase = getAdminUrl() ?? getAppUrl();

  return {
    async enquiryCreated(payload) {
      await Promise.all([
        sendEmail({
          to: payload.customerEmail,
          template: 'enquiry_confirmation',
          ...enquiryConfirmationEmail({
            customerName: payload.customerName,
            referenceCode: payload.referenceCode,
            listings: payload.listingNames,
          }),
        }),
        ...(await adminRecipients()).map((email) =>
          sendEmail({
            to: email,
            template: 'admin_new_enquiry',
            ...adminNewEnquiryEmail({
              referenceCode: payload.referenceCode,
              customerName: payload.customerName,
              customerEmail: payload.customerEmail,
              listings: payload.listingNames,
              eventDate: payload.eventDate,
              adminUrl: adminBase,
            }),
          }),
        ),
      ]);
    },

    async enquiryStatusChanged(payload) {
      await sendEmail({
        to: payload.customerEmail,
        template: 'enquiry_status',
        ...enquiryStatusEmail({
          customerName: '',
          referenceCode: payload.referenceCode,
          listingName: payload.listingName,
          status: payload.status,
          message: payload.customerVisibleMessage,
        }),
      });
    },

    async adminLeadAssigned(payload) {
      const admin = await prisma.user.findUnique({
        where: { id: payload.assignedAdminId },
        select: { email: true, name: true },
      });
      if (!admin?.email) return;

      await sendEmail({
        to: admin.email,
        template: 'admin_lead_assigned',
        subject: `Lead assigned: ${payload.referenceCode}`,
        html: `<p>Hi ${admin.name ?? 'there'},</p><p>Enquiry <strong>${payload.referenceCode}</strong> (${payload.listingName}) is now assigned to you.</p><p><a href="${adminBase}/enquiries">Open the enquiry inbox</a></p>`,
        text: `Enquiry ${payload.referenceCode} (${payload.listingName}) is assigned to you. ${adminBase}/enquiries`,
      });
    },
  };
}

/** Kept next to the port so the invite flow can reuse the rendered template. */
export async function sendVendorInviteEmail(input: {
  to: string;
  link: string;
  expiresAt: Date;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    template: 'vendor_invite',
    ...vendorInviteEmail(input),
  });
}

export async function sendVendorApplicationDecisionEmail(input: {
  to: string;
  businessName: string;
  approved: boolean;
  note?: string | null;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    template: 'vendor_decision',
    ...vendorApplicationDecisionEmail(input),
  });
}
