import { Suspense } from 'react';
import { connection } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminUrl, getServerEnv } from '@/lib/env';
import { formatDateTime } from '@/lib/format';
import { Button, PageHeader, StatusBadge, Surface, TableSkeleton } from '@/components/ui';
import { getSettings } from '@/server/services/settings.service';
import { TourLauncher, TourResetButton } from '@/components/tour/TourLauncher';
import { ADMIN_TOUR } from '@/lib/tours/admin-tour';
import {
  saveEmailSettingsAction,
  saveMetaSettingsAction,
  saveSiteSettingsAction,
  sendMetaTestAction,
} from './actions';
import classes from './page.module.css';

export const metadata = { title: 'Settings' };

const SAVED_LABEL: Record<string, string> = {
  site: 'Site settings saved.',
  email: 'Email settings saved.',
  meta: 'Meta settings saved.',
};

const ERROR_LABEL: Record<string, string> = {
  site: 'The site settings were not saved. Check the hero URL and expiry values.',
  email: 'The email settings were not saved. Use a valid from address and reply-to.',
  meta: 'The Meta settings were not saved. A Pixel ID is numeric and the test code is alphanumeric.',
};

function Notice({ saved, error, metaTest }: { saved?: string; error?: string; metaTest?: string }) {
  if (metaTest) {
    return (
      <Surface tone={metaTest === 'SENT' ? 'success' : 'warning'} padding="md">
        <p className={classes.notice}>
          {metaTest === 'SENT'
            ? 'Test event accepted by Meta. Check Events Manager → Test events.'
            : metaTest === 'SKIPPED'
              ? 'Meta is not configured yet, so no test event was sent.'
              : 'Meta rejected the test event. Check the token, pixel ID and the event log below.'}
        </p>
      </Surface>
    );
  }

  if (error && ERROR_LABEL[error]) {
    return (
      <Surface tone="danger" padding="md">
        <p className={classes.notice}>{ERROR_LABEL[error]}</p>
      </Surface>
    );
  }

  if (saved && SAVED_LABEL[saved]) {
    return (
      <Surface tone="success" padding="md">
        <p className={classes.notice}>{SAVED_LABEL[saved]}</p>
      </Surface>
    );
  }

  return null;
}

async function SettingsContent({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; metaTest?: string }>;
}) {
  await connection();

  const params = await searchParams;
  const env = getServerEnv();
  const adminUrl = getAdminUrl();
  const settings = await getSettings();

  const [emailLogs, metaLogs] = await Promise.all([
    prisma.emailLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.metaEventLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);

  return (
    <div className={classes.sections}>
      <Notice saved={params.saved} error={params.error} metaTest={params.metaTest} />

      <Surface tone="raised" padding="lg" className={classes.card}>
        <div>
          <h2 className={classes.cardTitle}>Guided tour</h2>
          <p className={classes.cardBody}>
            A two-minute walkthrough of the whole loop: onboarding a vendor, approving the draft
            listing and answering the first enquiry. It moves between pages as it goes, can be left
            at any point with Esc, and never changes any data. The vendor-facing walkthrough lives
            on the public <code>/partner-with-us</code> page.
          </p>
        </div>
        <div className={classes.buttonRow}>
          <TourLauncher tour={ADMIN_TOUR} label="Start the admin walkthrough" />
          <TourResetButton tours={[ADMIN_TOUR]} />
        </div>
      </Surface>

      <Surface tone="raised" padding="lg" className={classes.card}>
        <div>
          <h2 className={classes.cardTitle}>Site</h2>
          <p className={classes.cardBody}>
            The home hero and the public contact address. Changes apply on the next page load.
          </p>
        </div>
        <form action={saveSiteSettingsAction} className={classes.form}>
          <label className={classes.label} htmlFor="heroVideoUrl">
            Hero video URL
          </label>
          <input
            id="heroVideoUrl"
            name="heroVideoUrl"
            className={classes.input}
            defaultValue={settings.site.heroVideoUrl}
            placeholder="https://…/hero.mp4"
          />

          <label className={classes.label} htmlFor="heroVideoSegmentEndSeconds">
            Loop at (seconds)
          </label>
          <input
            id="heroVideoSegmentEndSeconds"
            name="heroVideoSegmentEndSeconds"
            className={classes.input}
            type="number"
            min={1}
            max={120}
            defaultValue={settings.site.heroVideoSegmentEndSeconds}
          />

          <label className={classes.label} htmlFor="contactEmail">
            Public contact email
          </label>
          <input
            id="contactEmail"
            name="contactEmail"
            className={classes.input}
            type="email"
            defaultValue={settings.site.contactEmail ?? ''}
            placeholder="hello@lifeevents.example"
          />

          <label className={classes.label} htmlFor="announcement">
            Announcement bar (optional)
          </label>
          <input
            id="announcement"
            name="announcement"
            className={classes.input}
            defaultValue={settings.site.announcement ?? ''}
            maxLength={280}
          />

          <Button type="submit" size="sm">
            Save site settings
          </Button>
        </form>
      </Surface>

      <Surface tone="raised" padding="lg" className={classes.card}>
        <div>
          <h2 className={classes.cardTitle}>Email</h2>
          <p className={classes.cardBody}>
            Outbound notifications go through Resend when{' '}
            <code>
              {env.RESEND_API_KEY ? 'RESEND_API_KEY is set' : 'RESEND_API_KEY is missing'}
            </code>
            . Without a key every message is recorded as skipped, so nothing fails silently.
          </p>
        </div>
        <form action={saveEmailSettingsAction} className={classes.form}>
          <label className={classes.label} htmlFor="fromAddress">
            From address
          </label>
          <input
            id="fromAddress"
            name="fromAddress"
            className={classes.input}
            defaultValue={settings.email.fromAddress}
            placeholder="Life Events <notifications@example.com>"
          />

          <label className={classes.label} htmlFor="replyTo">
            Reply-to (optional)
          </label>
          <input
            id="replyTo"
            name="replyTo"
            className={classes.input}
            type="email"
            defaultValue={settings.email.replyTo ?? ''}
            placeholder="hello@lifeevents.example"
          />

          <Button type="submit" size="sm">
            Save email settings
          </Button>
        </form>

        <div className={classes.logBlock}>
          <h3 className={classes.logTitle}>Recent email</h3>
          {emailLogs.length === 0 ? (
            <p className={classes.cardBody}>No email has been attempted yet.</p>
          ) : (
            <ul className={classes.logList}>
              {emailLogs.map((log) => (
                <li key={log.id} className={classes.logRow}>
                  <StatusBadge
                    tone={
                      log.status === 'SENT'
                        ? 'success'
                        : log.status === 'FAILED'
                          ? 'danger'
                          : 'neutral'
                    }
                    variant="soft"
                    size="sm"
                  >
                    {log.status.toLowerCase()}
                  </StatusBadge>
                  <span className={classes.logMain}>
                    {log.template} → {log.to}
                  </span>
                  <span className={classes.logMeta}>{formatDateTime(log.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Surface>

      <Surface
        tone="raised"
        padding="lg"
        className={classes.card}
        data-tour="settings-integrations"
      >
        <div>
          <h2 className={classes.cardTitle}>Meta Pixel &amp; Conversions API</h2>
          <p className={classes.cardBody}>
            The Pixel fires in the browser after analytics consent. The Conversions API sends the
            same <code>Lead</code> event server-side with the enquiry reference as{' '}
            <code>event_id</code>, so Meta deduplicates the pair. Emails, phones and names are
            hashed before they leave the server, and the token is stored encrypted.
          </p>
        </div>

        <form action={saveMetaSettingsAction} className={classes.form}>
          <label className={classes.checkboxRow}>
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={settings.meta.enabled}
              className={classes.checkbox}
            />
            Send events to Meta
          </label>

          <label className={classes.label} htmlFor="pixelId">
            Pixel ID
          </label>
          <input
            id="pixelId"
            name="pixelId"
            className={classes.input}
            defaultValue={settings.meta.pixelId ?? ''}
            inputMode="numeric"
            placeholder="123456789012345"
          />

          <label className={classes.label} htmlFor="testEventCode">
            Test event code (optional)
          </label>
          <input
            id="testEventCode"
            name="testEventCode"
            className={classes.input}
            defaultValue={settings.meta.testEventCode ?? ''}
            placeholder="TEST12345"
          />

          <label className={classes.label} htmlFor="capiToken">
            Conversions API token — stored encrypted, never shown again
          </label>
          <input
            id="capiToken"
            name="capiToken"
            className={classes.input}
            type="password"
            autoComplete="new-password"
            placeholder="Leave blank to keep the stored token, or enter - to clear it"
          />

          <div className={classes.buttonRow}>
            <Button type="submit" size="sm">
              Save Meta settings
            </Button>
          </div>
        </form>

        <form action={sendMetaTestAction}>
          <Button type="submit" size="sm" variant="default">
            Send test event
          </Button>
        </form>

        <div className={classes.logBlock}>
          <h3 className={classes.logTitle}>Recent conversions</h3>
          {metaLogs.length === 0 ? (
            <p className={classes.cardBody}>No Conversions API event has been attempted yet.</p>
          ) : (
            <ul className={classes.logList}>
              {metaLogs.map((log) => (
                <li key={log.id} className={classes.logRow}>
                  <StatusBadge
                    tone={
                      log.status === 'SENT'
                        ? 'success'
                        : log.status === 'FAILED'
                          ? 'danger'
                          : 'neutral'
                    }
                    variant="soft"
                    size="sm"
                  >
                    {log.status.toLowerCase()}
                  </StatusBadge>
                  <span className={classes.logMain}>
                    {log.eventName}
                    {log.eventId ? ` · ${log.eventId}` : ''}
                    {log.error ? ` · ${log.error}` : ''}
                  </span>
                  <span className={classes.logMeta}>{formatDateTime(log.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Surface>

      <Surface tone="muted" padding="lg" className={classes.card}>
        <div>
          <h2 className={classes.cardTitle}>Admin host</h2>
          <p className={classes.cardBody}>
            {adminUrl
              ? `Host routing is on. The back office is served from ${adminUrl} and public /admin URLs redirect there.`
              : 'Host routing is off. Set ADMIN_URL (e.g. http://admin.localhost.me:3000) to serve the back office from its own hostname. Until then the panel lives at /admin on the public host.'}
          </p>
        </div>
      </Surface>
    </div>
  );
}

export default function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; metaTest?: string }>;
}) {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Integrations, outbound email and the home hero. Secrets are write-only and encrypted at rest."
      />
      <Suspense fallback={<TableSkeleton rows={5} columns={2} />}>
        <SettingsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
