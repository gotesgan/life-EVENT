'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from '@/components/ui/ClientLink';
import { Button, Checkbox, NumberInput, Select, Textarea, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { schemaResolver, useForm, type FormErrors } from '@mantine/form';
import { IconCircleCheck, IconSend } from '@tabler/icons-react';
import { Surface } from '@/components/ui';
import { PRIVACY_POLICY_VERSION, createEnquirySchema } from '@/lib/validation/enquiry';
import classes from './ListingEnquiryForm.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

export interface ListingEnquiryFormProps {
  /**
   * The opaque public reference of the listing being enquired about
   * (`ul_<id>`) — never the slug, which would spell the withheld name out in
   * the request body.
   */
  listingRef: string;
  /** Event types offered by the catalogue; the enquiry can leave this blank. */
  eventTypeOptions: readonly SelectOption[];
  /** Rendered above the form while the venue's identity is still withheld. */
  hidden: boolean;
}

interface FormValues {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  eventDate: string | null;
  guestCount: string | number;
  eventTypeSlug: string;
  requirements: string;
  consentPrivacy: boolean;
  /** Honeypot — visually hidden, never labelled, skipped by the tab order. */
  companyWebsite: string;
  listings: string[];
}

/** Exactly the JSON body `POST /api/enquiries` accepts from this form. */
interface EnquiryPayload {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactMethod: 'EMAIL';
  eventDateFlexible: boolean;
  consentPrivacy: true;
  consentPolicyVersion: string;
  eventTypeSlug?: string;
  eventDate?: string;
  guestCount?: number;
  requirements?: string;
  companyWebsite?: string;
}

interface SubmissionResult {
  referenceCode: string;
  /** The real trading name, returned by the API once the enquiry exists. */
  listingName: string | null;
  duplicate: boolean;
}

function toOptionalNumber(value: string | number): number | undefined {
  if (value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * A stable idempotency key derived from the payload.
 *
 * A key identifies one *intent*: a retry after a timeout sends the same bytes and
 * so the same key, and the server replays the original enquiry instead of
 * creating a second lead; an edited form sends different bytes and so a new key.
 * FNV-1a is synchronous, needs no secure context, and the pair of 32-bit
 * accumulators below makes the key space 64 bits.
 */
function deriveIdempotencyKey(payload: unknown): string {
  const canonical = JSON.stringify(payload);
  const fnv1a32 = (seed: number): number => {
    let hash = seed;
    for (let index = 0; index < canonical.length; index += 1) {
      hash ^= canonical.charCodeAt(index);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0;
  };
  const high = fnv1a32(0x811c9dc5);
  const low = fnv1a32(0x01000193);
  return `listing-${high.toString(16).padStart(8, '0')}${low.toString(16).padStart(8, '0')}`;
}

/**
 * The enquiry form that sits beside a listing profile.
 *
 * One listing per form by design: the product asks visitors to enquire about the
 * venue, planner or decorator they are actually looking at, so every enquiry
 * carries a single business and can be triaged, assigned and answered on its own.
 *
 * Submitting unlocks the identity. The server sets a signed reveal cookie in the
 * same response, and `router.refresh()` re-renders the profile so the real name
 * and contact channels appear in place — no separate "check your email" step for
 * the thing the visitor came for.
 */
export function ListingEnquiryForm({
  listingRef,
  eventTypeOptions,
  hidden,
}: ListingEnquiryFormProps) {
  const router = useRouter();
  const [submitted, setSubmitted] = useState<SubmissionResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const validateWithSchema = useMemo(() => schemaResolver(createEnquirySchema, { sync: true }), []);

  const form = useForm<FormValues, EnquiryPayload>({
    initialValues: {
      contactName: '',
      contactPhone: '',
      contactEmail: '',
      eventDate: null,
      guestCount: '',
      eventTypeSlug: '',
      requirements: '',
      consentPrivacy: false,
      companyWebsite: '',
      listings: [listingRef],
    },
    validate: (values): FormErrors =>
      validateWithSchema({
        ...values,
        eventTypeSlug: values.eventTypeSlug || undefined,
        eventDate: values.eventDate || undefined,
        guestCount: values.guestCount === '' ? undefined : values.guestCount,
      }),
    transformValues: (values) => ({
      contactName: values.contactName.trim(),
      contactPhone: values.contactPhone.trim(),
      contactEmail: values.contactEmail.trim(),
      contactMethod: 'EMAIL' as const,
      eventDateFlexible: true,
      consentPrivacy: true as const,
      consentPolicyVersion: PRIVACY_POLICY_VERSION,
      ...(values.eventTypeSlug ? { eventTypeSlug: values.eventTypeSlug } : {}),
      ...(values.eventDate ? { eventDate: values.eventDate } : {}),
      ...(toOptionalNumber(values.guestCount) === undefined
        ? {}
        : { guestCount: toOptionalNumber(values.guestCount) }),
      ...(values.requirements.trim() ? { requirements: values.requirements.trim() } : {}),
      ...(values.companyWebsite ? { companyWebsite: values.companyWebsite } : {}),
    }),
  });

  async function handleSubmit(payload: EnquiryPayload) {
    setFormError(null);
    setPending(true);

    const body = { ...payload, listings: [listingRef] };

    let response: Response;
    try {
      response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': deriveIdempotencyKey(body),
        },
        body: JSON.stringify(body),
      });
    } catch {
      setPending(false);
      setFormError('We could not reach the server. Check your connection and try again.');
      return;
    }

    const result = await response.json().catch(() => null);
    setPending(false);

    if (response.ok && result?.data?.referenceCode) {
      setSubmitted({
        referenceCode: result.data.referenceCode as string,
        listingName:
          Array.isArray(result.data.listings) && typeof result.data.listings[0] === 'string'
            ? (result.data.listings[0] as string)
            : null,
        duplicate: result.data.duplicate === true,
      });
      // The reveal cookie was set by this response; re-render the server
      // components so the real name and contact details appear.
      router.refresh();
      return;
    }

    if (response.status === 400) {
      const fieldErrors = result?.error?.details?.fieldErrors as
        Record<string, string[] | undefined> | undefined;
      let mapped = 0;
      if (fieldErrors) {
        for (const [field, messages] of Object.entries(fieldErrors)) {
          if (!messages?.[0] || !(field in form.values)) continue;
          form.setFieldError(field as keyof FormValues, messages[0]);
          mapped += 1;
        }
      }
      setFormError(
        mapped > 0
          ? null
          : (result?.error?.message ?? 'Some details were not accepted. Please check the form.'),
      );
      return;
    }

    setFormError(
      result?.error?.message ??
        'Something went wrong on our side. Your enquiry was not sent. Try again.',
    );
  }

  if (submitted) {
    return (
      <Surface
        tone={submitted.duplicate ? 'muted' : 'success'}
        padding="md"
        className={classes.result}
      >
        <span className={classes.resultIcon} aria-hidden>
          <IconCircleCheck size="1.5rem" stroke={1.5} />
        </span>
        <h2 className={classes.resultTitle}>
          {submitted.duplicate ? 'Already received' : 'Enquiry sent'}
        </h2>
        <p className={classes.resultBody}>
          {submitted.listingName ? (
            <>
              You unlocked <strong>{submitted.listingName}</strong>. The business replies to you
              directly using the details you gave.
            </>
          ) : (
            <>The business replies to you directly using the details you gave.</>
          )}
        </p>
        <p className={classes.resultBody}>
          Reference <strong className={classes.reference}>{submitted.referenceCode}</strong> — keep
          it to check progress.
        </p>
        <Button component={Link} href="/track" variant="default" size="sm" fullWidth>
          Track this enquiry
        </Button>
      </Surface>
    );
  }

  return (
    <form className={classes.form} onSubmit={form.onSubmit(handleSubmit)} noValidate>
      <div className={classes.head}>
        <h2 className={classes.title}>
          {hidden ? 'Send an enquiry to unlock' : 'Send an enquiry'}
        </h2>
        <p className={classes.note}>
          {hidden
            ? 'Prices, capacity and facilities are published. The name and contact details unlock when you send this enquiry — free, and no account needed.'
            : 'Your details go to this business only. One enquiry, one reply, no phone-number chasing.'}
        </p>
      </div>

      <div className={classes.grid}>
        <TextInput
          label="Full name"
          placeholder="Your name"
          withAsterisk
          autoComplete="name"
          {...form.getInputProps('contactName')}
        />
        <TextInput
          label="Contact number"
          placeholder="98765 43210"
          withAsterisk
          type="tel"
          autoComplete="tel"
          leftSection={<span className={classes.prefix}>+91</span>}
          leftSectionWidth={54}
          {...form.getInputProps('contactPhone')}
        />
        <TextInput
          label="Email address"
          placeholder="you@example.com"
          withAsterisk
          type="email"
          autoComplete="email"
          {...form.getInputProps('contactEmail')}
        />
        <DatePickerInput
          label="Event date"
          placeholder="Pick a date"
          clearable
          valueFormat="D MMM YYYY"
          {...form.getInputProps('eventDate')}
        />
        <NumberInput
          label="Guests"
          placeholder="e.g. 250"
          min={1}
          max={200_000}
          allowDecimal={false}
          clampBehavior="blur"
          thousandSeparator=","
          {...form.getInputProps('guestCount')}
        />
        <Select
          label="Function type"
          placeholder="Choose if you know it"
          data={eventTypeOptions}
          clearable
          searchable
          nothingFoundMessage="No event type found"
          {...form.getInputProps('eventTypeSlug')}
        />
      </div>

      <Textarea
        label="Anything the business should know"
        placeholder="Timings, budget band, specific requirements…"
        autosize
        minRows={3}
        maxLength={4000}
        {...form.getInputProps('requirements')}
      />

      <Checkbox
        label={
          <span>
            I agree to the{' '}
            <Link href="/privacy" className={classes.inlineLink}>
              privacy terms
            </Link>{' '}
            and to this business contacting me about my event.
          </span>
        }
        {...form.getInputProps('consentPrivacy', { type: 'checkbox' })}
      />

      {/* Honeypot: off-screen, unlabelled, not in the tab order. A real visitor
          never fills it; automated submissions usually do. */}
      <div className={classes.honeypot} aria-hidden>
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...form.getInputProps('companyWebsite')}
        />
      </div>

      {formError ? (
        <p className={classes.error} role="alert">
          {formError}
        </p>
      ) : null}

      <Button
        type="submit"
        fullWidth
        size="md"
        loading={pending}
        leftSection={<IconSend size="1rem" stroke={1.6} aria-hidden />}
      >
        Send enquiry
      </Button>

      <p className={classes.footnote}>
        No account needed. One enquiry per business, so replies and prices stay clear.
      </p>
    </form>
  );
}
