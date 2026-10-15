import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AccountNav } from '@/components/account/AccountNav';
import { ProfileForm } from '@/components/account/ProfileForm';
import { SiteShell } from '@/components/layout/SiteShell';
import { Container, PageHeader, Surface } from '@/components/ui';
import { getCurrentActor } from '@/lib/auth/actor';
import { getAccountOverview } from '@/server/services/account.service';
import { listLocations } from '@/server/services/catalog.service';
import classes from '../account.module.css';

export const instant = false;

export const metadata: Metadata = {
  title: 'Your profile',
  description: 'The details we hold about you and how businesses should contact you.',
  robots: { index: false, follow: false },
};

const STATUS_EXPLANATIONS: Record<string, string> = {
  ACTIVE: 'Your account is in good standing and everything works normally.',
  SUSPENDED:
    'An administrator has paused this account. You can still sign in, but new enquiries are blocked.',
  DEACTIVATED: 'This account has been deactivated. Contact us if you think that is wrong.',
};

export default async function AccountProfilePage() {
  const actor = await getCurrentActor();
  if (actor.kind === 'anonymous') redirect('/sign-in?next=%2Faccount%2Fprofile');

  const [overview, cities] = await Promise.all([
    getAccountOverview(actor.user.id),
    listLocations({ type: 'CITY' }),
  ]);

  /*
   * The canonical option list is the cities, but a profile may already point at a
   * location that is not a `CITY` (the seeded customer's is a locality). Keeping
   * the current value in the list means the control shows its real name and the
   * customer can leave it untouched instead of being silently reassigned.
   */
  const cityOptions = cities.map((city) => ({ value: city.slug, label: city.name }));
  const currentCity = overview.profile.city;
  if (currentCity && !cityOptions.some((option) => option.value === currentCity.slug)) {
    cityOptions.unshift({ value: currentCity.slug, label: currentCity.name });
  }

  return (
    <SiteShell>
      <Container>
        <PageHeader
          title="Your profile"
          description="These details appear on the enquiries you send. Change anything here and it applies to every future enquiry."
        />

        <AccountNav active="profile" />

        {/* This is a page a customer fills in once and then leaves alone, so it
            runs at the editorial register. */}
        <div className={`${classes.columns} surface--editorial`}>
          <Surface padding="md">
            <h2 className={classes.panelTitle}>Editable details</h2>
            <ProfileForm
              defaultValues={{
                name: overview.user.name,
                phone: overview.profile.phone ?? '',
                citySlug: overview.profile.city?.slug ?? null,
                preferredContactMethod: overview.profile.preferredContactMethod,
                marketingConsent: overview.profile.marketingConsent,
              }}
              cities={cityOptions}
            />
          </Surface>

          <aside>
            <Surface padding="md">
              <h2 className={classes.panelTitle}>Read-only details</h2>
              <p className={classes.muted}>
                These are set by the system, not by you, so they are shown here rather than as
                disabled inputs.
              </p>

              <dl className={classes.dlSpaced}>
                <dt className={classes.dt}>Email</dt>
                <dd className={classes.dd}>
                  {actor.user.email}
                  <span className={classes.readOnlyNote}>
                    This address identifies your account. Changing it needs a verification step the
                    MVP does not ship yet, so contact us and an administrator will update it.
                  </span>
                </dd>

                <dt className={classes.dt}>Role</dt>
                <dd className={classes.dd}>
                  {actor.user.role === 'ADMIN' ? 'Administrator' : 'Customer'}
                  <span className={classes.readOnlyNote}>
                    Roles are assigned by an administrator and cannot be changed from your account.
                  </span>
                </dd>

                <dt className={classes.dt}>Status</dt>
                <dd className={classes.dd}>
                  {actor.user.status.charAt(0) + actor.user.status.slice(1).toLowerCase()}
                  <span className={classes.readOnlyNote}>
                    {STATUS_EXPLANATIONS[actor.user.status] ??
                      'Account status is managed by an administrator.'}
                  </span>
                </dd>

                <dt className={classes.dt}>Email verified</dt>
                <dd className={classes.dd}>
                  {overview.user.emailVerified ? 'Yes' : 'Not yet'}
                  <span className={classes.readOnlyNote}>
                    Email verification is not part of the MVP, so this stays as it is.
                  </span>
                </dd>
              </dl>
            </Surface>
          </aside>
        </div>
      </Container>
    </SiteShell>
  );
}
