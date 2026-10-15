import type { Metadata } from 'next';
import Link from '@/components/ui/ClientLink';
import { notFound, redirect } from 'next/navigation';
import { Button } from '@mantine/core';
import { AccountNav } from '@/components/account/AccountNav';
import { CancelEnquiryButton } from '@/components/account/CancelEnquiryButton';
import { EnquiryStatusBadge } from '@/components/account/EnquiryStatusBadge';
import { EnquiryStatusTimeline } from '@/components/account/EnquiryStatusTimeline';
import { contactMethodLabel } from '@/components/account/contact-method';
import { SiteShell } from '@/components/layout/SiteShell';
import { ClientLink, Container, PageHeader, StatusBadge, Surface } from '@/components/ui';
import { getCurrentActor } from '@/lib/auth/actor';
import { NotFoundError } from '@/lib/errors';
import { formatDate, formatPriceRange } from '@/lib/format';
import { getCustomerEnquiry } from '@/server/services/enquiry.service';
import classes from '../../account.module.css';

export const instant = false;

interface EnquiryPageProps {
  params: Promise<{ referenceCode: string }>;
}

export async function generateMetadata({ params }: EnquiryPageProps): Promise<Metadata> {
  const { referenceCode } = await params;
  return {
    title: `Enquiry ${referenceCode.toUpperCase()}`,
    description: 'The current stage, history and businesses on one of your enquiries.',
    robots: { index: false, follow: false },
  };
}

export default async function AccountEnquiryDetailPage({ params }: EnquiryPageProps) {
  const { referenceCode: rawReferenceCode } = await params;
  // Reference codes are stored upper-case; normalising here keeps a pasted
  // lower-case code working exactly as it does through the JSON API.
  const referenceCode = rawReferenceCode.trim().toUpperCase();

  const actor = await getCurrentActor();
  if (actor.kind === 'anonymous') {
    redirect(
      `/sign-in?next=${encodeURIComponent(`/account/enquiries/${encodeURIComponent(referenceCode)}`)}`,
    );
  }

  let enquiry;
  try {
    enquiry = await getCustomerEnquiry(actor.user.id, referenceCode);
  } catch (error) {
    // An enquiry that is not this account's is indistinguishable from one that
    // does not exist — that is the point of the ownership clause in the query.
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const budget = formatPriceRange({
    priceMin: enquiry.budgetMin,
    priceMax: enquiry.budgetMax,
    priceUnit: null,
  });

  return (
    <SiteShell>
      <Container>
        <PageHeader
          eyebrow="Reference code"
          title={enquiry.referenceCode}
          description="Quote this reference code if you contact us about this enquiry. It works together with the email address on the account."
          breadcrumbs={[
            { label: 'Account', href: '/account' },
            { label: 'My enquiries', href: '/account/enquiries' },
            { label: enquiry.referenceCode },
          ]}
        />

        <AccountNav active="enquiries" />

        <div className={classes.detailGrid}>
          <div>
            <Surface padding="md">
              <h2 className={classes.panelTitle}>Where this enquiry stands</h2>
              <div className={classes.itemHeader}>
                <EnquiryStatusBadge status={enquiry.status} label={enquiry.statusLabel} size="md" />
                <p className={classes.itemMeta}>
                  Sent {formatDate(enquiry.createdAt) ?? 'on an unknown date'}
                </p>
              </div>
              <p className={classes.providerStatus}>{enquiry.statusDescription}</p>

              <dl className={classes.dlSpaced}>
                <dt className={classes.dt}>Event</dt>
                <dd className={classes.dd}>
                  {enquiry.eventTypeName ?? <span className={classes.notGiven}>Not specified</span>}
                  {enquiry.eventDate
                    ? ` · ${formatDate(enquiry.eventDate) ?? 'unknown date'}${
                        enquiry.eventDateFlexible ? ' (flexible)' : ''
                      }`
                    : ' · date not fixed'}
                </dd>

                <dt className={classes.dt}>Guests</dt>
                <dd className={classes.dd}>
                  {enquiry.guestCount ? (
                    `${enquiry.guestCount} guests`
                  ) : (
                    <span className={classes.notGiven}>Not specified</span>
                  )}
                </dd>

                <dt className={classes.dt}>Budget</dt>
                <dd className={classes.dd}>
                  {budget ?? <span className={classes.notGiven}>Not specified</span>}
                </dd>
              </dl>
            </Surface>

            <Surface padding="md" className={classes.section}>
              <h2 className={classes.panelTitle}>
                {enquiry.listings.length === 1 ? 'The business' : 'The businesses'}
              </h2>

              <ul className={classes.providerList}>
                {enquiry.listings.map((listing) => {
                  const contact = listing.contact;
                  const hasContact = Boolean(
                    contact.phone || contact.email || contact.whatsapp || contact.website,
                  );

                  return (
                    <li key={listing.listingId} className={classes.item}>
                      <div className={classes.providerHeader}>
                        <div>
                          <p className={classes.providerName}>
                            <Link
                              className={classes.itemLink}
                              href={`/vendors/${encodeURIComponent(listing.slug)}`}
                            >
                              {listing.name}
                            </Link>
                          </p>
                          <p className={classes.providerMeta}>
                            {[listing.categoryName, listing.locationName]
                              .filter(Boolean)
                              .join(' · ') || 'Category not recorded'}
                          </p>
                        </div>
                        {/*
                          The DTO gives each lead a customer-facing label but not
                          its enum value, so the tone stays neutral here rather
                          than borrowing the enquiry's overall status tone and
                          implying a state this lead is not in.
                        */}
                        <StatusBadge tone="neutral" size="sm" dot>
                          {listing.statusLabel}
                        </StatusBadge>
                      </div>

                      <p className={classes.providerStatus}>{listing.statusDescription}</p>

                      {hasContact ? (
                        <ul className={classes.contactList}>
                          <li className={classes.contactRow}>
                            <span className={classes.contactLabel}>Contact</span>
                            <span className={classes.contactValue}>
                              {contact.phone ? (
                                <a href={`tel:${contact.phone.replace(/\s+/g, '')}`}>
                                  {contact.phone}
                                </a>
                              ) : null}
                              {contact.phone && (contact.email || contact.whatsapp) ? ' · ' : ''}
                              {contact.email ? (
                                <a href={`mailto:${contact.email}`}>{contact.email}</a>
                              ) : null}
                              {contact.email && contact.whatsapp ? ' · ' : ''}
                              {contact.whatsapp ? (
                                <a
                                  href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}
                                  rel="noreferrer noopener"
                                  target="_blank"
                                >
                                  WhatsApp
                                </a>
                              ) : null}
                              {contact.website ? (
                                <>
                                  {(contact.phone || contact.email || contact.whatsapp) && ' · '}
                                  <a
                                    href={contact.website}
                                    rel="noreferrer noopener"
                                    target="_blank"
                                  >
                                    Website
                                  </a>
                                </>
                              ) : null}
                            </span>
                          </li>
                        </ul>
                      ) : (
                        <div className={classes.notice}>
                          <span className={classes.noticeLabel}>Contact details not shown yet</span>
                          {contact.message ??
                            'This business keeps its contact details off the public page. We will share them with you as the enquiry progresses.'}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Surface>

            <Surface padding="md" className={classes.section}>
              <h2 className={classes.panelTitle}>History</h2>
              <EnquiryStatusTimeline entries={enquiry.timeline} />
            </Surface>
          </div>

          <aside>
            <Surface padding="md">
              <h2 className={classes.panelTitle}>The details you gave us</h2>
              <dl className={classes.dl}>
                <dt className={classes.dt}>Name</dt>
                <dd className={classes.dd}>{enquiry.contactName}</dd>

                <dt className={classes.dt}>Email</dt>
                <dd className={classes.dd}>{enquiry.contactEmail}</dd>

                <dt className={classes.dt}>Phone</dt>
                <dd className={classes.dd}>{enquiry.contactPhone}</dd>

                <dt className={classes.dt}>Contact by</dt>
                <dd className={classes.dd}>{contactMethodLabel(enquiry.contactMethod)}</dd>

                <dt className={classes.dt}>City</dt>
                <dd className={classes.dd}>
                  {enquiry.contactCityName ?? (
                    <span className={classes.notGiven}>Not specified</span>
                  )}
                </dd>

                <dt className={classes.dt}>Your brief</dt>
                <dd className={classes.dd}>
                  {enquiry.requirements ? (
                    enquiry.requirements
                  ) : (
                    <span className={classes.notGiven}>No brief was added.</span>
                  )}
                </dd>
              </dl>
            </Surface>

            <Surface padding="md" className={classes.section}>
              <h2 className={classes.panelTitle}>Cancel this enquiry</h2>
              {enquiry.canCancel ? (
                <>
                  <p className={classes.muted}>
                    You can withdraw this enquiry while the businesses are still being contacted.
                  </p>
                  <div className={classes.actionsSpaced}>
                    <CancelEnquiryButton referenceCode={enquiry.referenceCode} />
                  </div>
                </>
              ) : (
                <p className={classes.muted}>
                  This enquiry can no longer be cancelled from your account because a business is
                  already in contact with you. Reply to their message instead — or contact us and we
                  will close it for you.
                </p>
              )}
            </Surface>

            <div className={classes.actionsSpaced}>
              <Button component={ClientLink} href="/account/enquiries" variant="default" size="sm">
                Back to all enquiries
              </Button>
            </div>
          </aside>
        </div>
      </Container>
    </SiteShell>
  );
}
