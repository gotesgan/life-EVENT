'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Stack, TextInput } from '@mantine/core';
import { schemaResolver, useForm } from '@mantine/form';
import { IconAlertTriangle, IconSearch, IconSearchOff } from '@tabler/icons-react';
import { Surface } from '@/components/ui/Surface';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { enquiryStatusTone, enquiryStatusVariant } from '@/components/account/EnquiryStatusBadge';
import { formatDate } from '@/lib/format';
import { trackEnquirySchema } from '@/lib/validation/enquiry';
import classes from './TrackForm.module.css';

export interface TrackFormProps {
  /** Pre-filled from `?reference=` after a successful submission. */
  initialReference?: string;
  initialEmail?: string;
}

interface TrackFormValues {
  referenceCode: string;
  email: string;
}

interface TrackedEnquiry {
  referenceCode: string;
  status: string;
  statusLabel: string;
  statusDescription: string;
  createdAt: string;
  eventDate: string | null;
  listings: Array<{ name: string; slug: string; statusLabel: string }>;
}

function isTrackedEnquiry(value: unknown): value is TrackedEnquiry {
  if (typeof value !== 'object' || value === null) return false;
  const data = value as Partial<TrackedEnquiry>;
  return (
    typeof data.referenceCode === 'string' &&
    typeof data.statusLabel === 'string' &&
    typeof data.statusDescription === 'string' &&
    Array.isArray(data.listings)
  );
}

function readData(value: unknown): TrackedEnquiry | null {
  if (typeof value !== 'object' || value === null || !('data' in value)) return null;
  const data = (value as { data: unknown }).data;
  return isTrackedEnquiry(data) ? data : null;
}

function readErrorMessage(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('error' in value)) return null;
  const error = (value as { error: unknown }).error;
  if (typeof error !== 'object' || error === null) return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : null;
}

function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function retryGuidance(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '';
  if (seconds < 60) return ` Please try again in ${seconds} second${seconds === 1 ? '' : 's'}.`;
  const minutes = Math.round(seconds / 60);
  return ` Please try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

/**
 * Guest progress lookup.
 *
 * Deliberately asks for the reference **and** the email, because the endpoint
 * requires both: knowing one reveals nothing about the other. On a mismatch the
 * screen shows one message that never hints which half was right — the same
 * posture the API takes with its 404.
 *
 * The status pill is tone-mapped from the real status rather than always drawn
 * in the brand colour, so a booked enquiry and a closed one are not painted the
 * same; the dot and the label carry the meaning either way.
 */
export function TrackForm({ initialReference, initialEmail }: TrackFormProps) {
  const [result, setResult] = useState<TrackedEnquiry | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const validateWithSchema = schemaResolver(trackEnquirySchema, { sync: true });

  const form = useForm<TrackFormValues, TrackFormValues>({
    initialValues: {
      referenceCode: initialReference ?? '',
      email: initialEmail ?? '',
    },
    validate: (values) => validateWithSchema(values),
    transformValues: (values) => ({
      referenceCode: values.referenceCode.trim().toUpperCase(),
      email: values.email.trim().toLowerCase(),
    }),
    onValuesChange: () => {
      // Any edit invalidates a previous answer: a stale status beside new input
      // is worse than no status at all.
      setResult(null);
      setNotFound(false);
      setFormError(null);
    },
  });

  async function handleSubmit(values: TrackFormValues) {
    setFormError(null);
    setNotFound(false);

    let response: Response;
    try {
      response = await fetch('/api/enquiries/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
    } catch {
      setFormError('We could not reach the server. Check your connection and try again.');
      return;
    }

    const body = await readJson(response);

    if (response.ok) {
      const data = readData(body);
      if (data) {
        setResult(data);
        return;
      }
      setFormError('Something went wrong on our side. Try again in a moment.');
      return;
    }

    if (response.status === 404) {
      setNotFound(true);
      return;
    }

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('Retry-After'));
      setFormError(
        `${readErrorMessage(body) ?? 'Too many tracking attempts.'}${retryGuidance(
          Number.isFinite(retryAfter) ? retryAfter : null,
        )}`,
      );
      return;
    }

    setFormError(
      readErrorMessage(body) ?? 'Something went wrong on our side. Your enquiry is not affected.',
    );
  }

  return (
    <Stack gap="lg">
      <Surface tone="raised" padding="lg" className={classes.lookup}>
        <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
          <Stack gap="md">
            <TextInput
              label="Reference code"
              description="It looks like LE-7K3M9QP2 and is in the first email we sent you."
              placeholder="LE-7K3M9QP2"
              autoComplete="off"
              autoCapitalize="characters"
              withAsterisk
              {...form.getInputProps('referenceCode')}
            />
            <TextInput
              label="Email you used"
              type="email"
              description="The address you entered on the enquiry form."
              placeholder="priya@example.com"
              autoComplete="email"
              withAsterisk
              {...form.getInputProps('email')}
            />

            {formError ? (
              <p className={classes.error} role="alert">
                <IconAlertTriangle
                  className={classes.errorIcon}
                  size="1rem"
                  stroke={1.5}
                  aria-hidden
                />{' '}
                {formError}
              </p>
            ) : null}

            <Button
              type="submit"
              className={classes.submit}
              loading={form.submitting}
              leftSection={<IconSearch size="1rem" stroke={1.5} aria-hidden />}
            >
              Find my enquiry
            </Button>
          </Stack>
        </form>
      </Surface>

      {notFound ? (
        <Surface tone="muted" padding="lg" className={classes.state}>
          <span className={classes.stateIcon} aria-hidden>
            <IconSearchOff size="1.25rem" stroke={1.5} />
          </span>
          <p className={classes.notFound} role="status">
            We could not find an enquiry with that reference and email. Check both and try again —
            the reference is in the first email we sent you.
          </p>
          <p className={classes.help}>
            Sent your enquiry from a different address? Try that one. Still stuck?{' '}
            <Link className={classes.link} href="/vendors">
              Start a new enquiry
            </Link>
            .
          </p>
        </Surface>
      ) : null}

      {result ? (
        <Surface tone="raised" padding="lg" className={classes.result}>
          <div className={classes.resultHead}>
            <div className={classes.referenceBlock}>
              <p className={classes.referenceLabel}>Reference</p>
              <p className={classes.reference}>{result.referenceCode}</p>
            </div>
            <StatusBadge
              tone={enquiryStatusTone(result.status)}
              variant={enquiryStatusVariant(result.status)}
              size="md"
              dot
            >
              {result.statusLabel}
            </StatusBadge>
          </div>

          <p className={classes.statusDescription}>{result.statusDescription}</p>

          {result.eventDate ? (
            <p className={classes.meta}>Event date: {formatDate(result.eventDate)}</p>
          ) : null}

          <div className={classes.providers}>
            <h2 className={classes.providersTitle}>Businesses in this enquiry</h2>
            <ul className={classes.providerList}>
              {result.listings.map((listing) => (
                <li key={listing.slug} className={classes.provider}>
                  <Link className={classes.link} href={`/vendors/${listing.slug}`}>
                    {listing.name}
                  </Link>
                  <StatusBadge tone="neutral" size="sm" dot>
                    {listing.statusLabel}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          </div>
        </Surface>
      ) : null}
    </Stack>
  );
}
