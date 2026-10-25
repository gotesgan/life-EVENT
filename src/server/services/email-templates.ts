import { getAppUrl } from '@/lib/env';

/**
 * Transactional email bodies.
 *
 * Inline styles and a single column, because these are read in mail clients that
 * strip stylesheets. Kept as plain functions returning `{ subject, html, text }`
 * so every template can be unit-tested without a provider, and so the sender
 * stays transport-only.
 */
export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

const BRAND = 'Life Events';

function layout(heading: string, body: string, footer?: string): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#faf7f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1714;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e0d5;border-radius:12px;padding:28px;">
      <p style="margin:0 0 18px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8a1a15;">${BRAND}</p>
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;font-weight:600;">${heading}</h1>
      ${body}
      <hr style="border:0;border-top:1px solid #e7e0d5;margin:24px 0 16px;" />
      <p style="margin:0;font-size:12px;line-height:1.6;color:#5c5347;">
        ${footer ?? `${BRAND} — wedding and event vendors, with published prices.`}
      </p>
    </div>
  </body>
</html>`;
}

function paragraph(html: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${html}</p>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:20px 0;"><a href="${href}" style="display:inline-block;background:#191512;color:#ffffff;padding:12px 18px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">${label}</a></p>`;
}

export function vendorInviteEmail(input: {
  email?: string | null;
  link: string;
  expiresAt: Date;
}): EmailTemplate {
  const expiry = input.expiresAt.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return {
    subject: `Finish your ${BRAND} listing`,
    html: layout(
      'Finish your listing',
      [
        paragraph('Your business can go live on Life Events once you add its details.'),
        paragraph(
          'The link below opens a form for the business name, category, city, contact person, prices and photos. It takes about ten minutes, works on a phone, and you can send it back to us when you are done.',
        ),
        button(input.link, 'Open the listing form'),
        paragraph(
          `<span style="color:#5c5347;font-size:13px;">This link is single-use and expires on ${expiry}.</span>`,
        ),
      ].join(''),
      `You received this because your business was invited to list on ${BRAND}.`,
    ),
    text: [
      `Finish your ${BRAND} listing`,
      '',
      'Your business can go live on Life Events once you add its details.',
      'Open the form:',
      input.link,
      '',
      `This link is single-use and expires on ${expiry}.`,
    ].join('\n'),
  };
}

export function vendorApplicationDecisionEmail(input: {
  businessName: string;
  approved: boolean;
  note?: string | null;
}): EmailTemplate {
  return {
    subject: input.approved
      ? `Your ${BRAND} application is approved`
      : `About your ${BRAND} application`,
    html: layout(
      input.approved ? 'You are approved' : 'Your application was not approved',
      [
        paragraph(`Hello ${input.businessName},`),
        paragraph(
          input.approved
            ? 'Your business has been approved for a listing. We will send you a link to complete the details before it goes live.'
            : 'Thanks for applying. We are not listing this business at the moment.',
        ),
        input.note ? paragraph(`<strong>Note from the team:</strong> ${input.note}`) : '',
      ].join(''),
    ),
    text: [
      `Hello ${input.businessName},`,
      '',
      input.approved
        ? 'Your business has been approved for a listing on Life Events.'
        : 'Thanks for applying. We are not listing this business at the moment.',
      input.note ? `Note from the team: ${input.note}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

export function vendorOnboardingSubmittedEmail(input: {
  businessName: string;
  applicationId: string;
  adminUrl: string;
}): EmailTemplate {
  return {
    subject: `Vendor details submitted: ${input.businessName}`,
    html: layout(
      'Vendor details submitted',
      [
        paragraph(`<strong>${input.businessName}</strong> filled in the onboarding form.`),
        paragraph(
          'Review the submission and create the listing draft from the vendor applications page.',
        ),
        button(`${input.adminUrl}/vendor-applications`, 'Review the application'),
      ].join(''),
    ),
    text: `Vendor details submitted by ${input.businessName}. Review: ${input.adminUrl}/vendor-applications`,
  };
}

export function adminNewEnquiryEmail(input: {
  referenceCode: string;
  customerName: string;
  customerEmail: string;
  listings: string[];
  eventDate: Date | null;
  adminUrl: string;
}): EmailTemplate {
  const date = input.eventDate
    ? input.eventDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'not set';
  return {
    subject: `New enquiry ${input.referenceCode}: ${input.listings.join(', ')}`,
    html: layout(
      'New enquiry',
      [
        paragraph(
          `Reference <strong>${input.referenceCode}</strong> from ${input.customerName} (${input.customerEmail}).`,
        ),
        paragraph(`Businesses: ${input.listings.join(', ')}`),
        paragraph(`Event date: ${date}`),
        button(`${input.adminUrl}/enquiries`, 'Open the enquiry inbox'),
      ].join(''),
    ),
    text: [
      `New enquiry ${input.referenceCode}`,
      `From: ${input.customerName} <${input.customerEmail}>`,
      `Businesses: ${input.listings.join(', ')}`,
      `Event date: ${date}`,
      `${input.adminUrl}/enquiries`,
    ].join('\n'),
  };
}

export function enquiryConfirmationEmail(input: {
  customerName: string;
  referenceCode: string;
  listings: string[];
}): EmailTemplate {
  return {
    subject: `We have your enquiry ${input.referenceCode}`,
    html: layout(
      'Your enquiry is in',
      [
        paragraph(`Hello ${input.customerName},`),
        paragraph(`We sent your brief to: <strong>${input.listings.join(', ')}</strong>.`),
        paragraph(
          `Track it any time with reference <strong>${input.referenceCode}</strong>. Contact details for each business appear in the enquiry once it has been shared with them.`,
        ),
        button(
          `${getAppUrl()}/track?reference=${encodeURIComponent(input.referenceCode)}`,
          'Track your enquiry',
        ),
      ].join(''),
    ),
    text: [
      `Hello ${input.customerName},`,
      '',
      `Your brief was sent to: ${input.listings.join(', ')}.`,
      `Reference: ${input.referenceCode}`,
      `Track: ${getAppUrl()}/track?reference=${encodeURIComponent(input.referenceCode)}`,
    ].join('\n'),
  };
}

export function enquiryStatusEmail(input: {
  customerName: string;
  referenceCode: string;
  listingName: string;
  status: string;
  message?: string | null;
}): EmailTemplate {
  return {
    subject: `Update on ${input.referenceCode}: ${input.listingName}`,
    html: layout(
      'Your enquiry moved forward',
      [
        paragraph(`Hello ${input.customerName},`),
        paragraph(
          `<strong>${input.listingName}</strong> is now <strong>${input.status.toLowerCase().replace(/_/g, ' ')}</strong>.`,
        ),
        input.message ? paragraph(input.message) : '',
        button(
          `${getAppUrl()}/track?reference=${encodeURIComponent(input.referenceCode)}`,
          'See the details',
        ),
      ].join(''),
    ),
    text: [
      `Hello ${input.customerName},`,
      `${input.listingName} is now ${input.status.toLowerCase().replace(/_/g, ' ')}.`,
      input.message ?? '',
      `${getAppUrl()}/track?reference=${encodeURIComponent(input.referenceCode)}`,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}
