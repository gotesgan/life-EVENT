'use client';

import { useMemo, useState } from 'react';
import Link from '@/components/ui/ClientLink';
import { Button, Checkbox, NumberInput, Select, Textarea, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { schemaResolver, useForm, type FormErrors } from '@mantine/form';
import {
  IconAlertTriangle,
  IconBuildingStore,
  IconCircleCheck,
  IconInfoCircle,
  IconPlus,
  IconSend,
  IconX,
} from '@tabler/icons-react';
import { StatusBadge, Surface, cx } from '@/components/ui';
import type { ContactMethod } from '@/generated/prisma/enums';
import { createEnquirySchema } from '@/lib/validation/enquiry';
import classes from './EnquiryForm.module.css';

export interface ProviderOption {
  slug: string;
  name: string;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface EnquiryFormProps {
  /** Businesses carried over from the results page, in the order chosen. */
  providers: readonly ProviderOption[];
  cityOptions: readonly SelectOption[];
  eventTypeOptions: readonly SelectOption[];
  /** The policy version a consent is recorded against — never hard-coded twice. */
  policyVersion: string;
  initialValues?: {
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    contactCitySlug?: string;
    contactMethod?: ContactMethod;
  };
}

interface EnquiryFormValues {
  listings: string[];
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactCitySlug: string;
  contactMethod: ContactMethod;
  eventTypeSlug: string;
  eventDate: string | null;
  eventDateFlexible: boolean;
  guestCount: string | number;
  budgetMin: string | number;
  budgetMax: string | number;
  requirements: string;
  consentPrivacy: boolean;
  companyWebsite: string;
}

/** Exactly the JSON body `POST /api/enquiries` accepts. */
interface EnquiryPayload {
  listings: string[];
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactMethod: ContactMethod;
  eventDateFlexible: boolean;
  consentPrivacy: true;
  consentPolicyVersion: string;
  contactCitySlug?: string;
  eventTypeSlug?: string;
  eventDate?: string;
  guestCount?: number;
  budgetMin?: number;
  budgetMax?: number;
  requirements?: string;
  companyWebsite?: string;
}

interface SubmissionResult {
  referenceCode: string;
  duplicate: boolean;
}

interface EnquiryErrorBody {
  error?: {
    code?: string;
    message?: string;
    /**
     * Zod's flatten shape (`fieldErrors` / `formErrors`) is the common envelope,
     * but a service may also report a field problem directly — the enquiry
     * service answers an unknown slug with `{ listings: ['the-slug'] }`. Both are
     * read, because both are field-level and both belong on the field.
     */
    details?: {
      fieldErrors?: Record<string, string[] | undefined>;
      formErrors?: string[];
      [key: string]: unknown;
    };
  };
}

const MAX_PROVIDERS = 10;

/**
 * The honeypot is a real field the API understands, so its name is a legal
 * `fieldErrors` key. It is never on screen, so an error reported against it can
 * never be shown on the field — it has to fall through to the form-level notice
 * instead of being mapped onto an input the visitor cannot see.
 */
const HIDDEN_FIELDS = new Set<string>(['companyWebsite']);

/**
 * Derives the idempotency key from the payload it belongs to.
 *
 * A key identifies one *intent*, so it must be stable for a retry of the same
 * intent and different for an edited one. Deriving it from the payload gives
 * both properties exactly, without any component state:
 *
 *  - a retry after a timeout or a network failure sends the same payload and so
 *    the same key, and the server replays the original enquiry instead of
 *    creating a second lead — the contract in `docs/api-design.md` §8;
 *  - a corrected submission sends different bytes and so a different key, which
 *    is what makes "fix the typo and send again" work instead of colliding with
 *    the key already spent on the rejected attempt;
 *  - two rapid clicks on an untouched form produce the same key, so the second
 *    is a replay rather than a duplicate lead.
 *
 * A random key held in state was tried first and was wrong in two ways: it
 * survived an edit (so correcting a rejected enquiry dead-ended on a key
 * mismatch), and reading it from component state made two submissions inside one
 * render both observe the stale value.
 *
 * FNV-1a is used rather than `crypto.subtle` because it is synchronous and needs
 * no secure context — and rather than `BigInt`, because the project targets below
 * ES2020. Two independent 32-bit accumulators are combined so the key space is
 * 64 bits: a single 32-bit hash would collide after roughly 65k submissions, and
 * a collision between two different customers' briefs would surface as a
 * confusing "key already used" refusal. 64 bits makes that negligible, and the
 * server re-checks the full payload hash regardless.
 */
function deriveIdempotencyKey(payload: EnquiryPayload): string {
  const canonical = JSON.stringify(payload);

  const fnv1a32 = (seed: number): number => {
    let hash = seed;
    for (let index = 0; index < canonical.length; index += 1) {
      hash ^= canonical.charCodeAt(index);
      // FNV prime 16777619, expressed as shifts so the multiply stays in 32-bit
      // range without BigInt.
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0;
  };

  const high = fnv1a32(0x811c9dc5);
  const low = fnv1a32(0x01000193);

  return `web-${high.toString(16).padStart(8, '0')}${low.toString(16).padStart(8, '0')}`;
}

function isSubmissionResult(
  value: unknown,
): value is { data: { referenceCode: string; duplicate: boolean } } {
  if (typeof value !== 'object' || value === null || !('data' in value)) return false;
  const data = (value as { data: unknown }).data;
  if (typeof data !== 'object' || data === null) return false;
  return (
    typeof (data as { referenceCode?: unknown }).referenceCode === 'string' &&
    typeof (data as { duplicate?: unknown }).duplicate === 'boolean'
  );
}

function readErrorBody(value: unknown): EnquiryErrorBody['error'] | null {
  if (typeof value !== 'object' || value === null || !('error' in value)) return null;
  const error = (value as { error: unknown }).error;
  if (typeof error !== 'object' || error === null) return null;
  return error as EnquiryErrorBody['error'];
}

function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function toOptionalNumber(value: string | number): number | undefined {
  if (value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function retryGuidance(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '';
  if (seconds < 60) return ` Please try again in ${seconds} second${seconds === 1 ? '' : 's'}.`;
  const minutes = Math.round(seconds / 60);
  return ` Please try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

/** The three steps the confirmation promises, in the order they happen. */
const NEXT_STEPS: readonly string[] = [
  'Your enquiry reaches the businesses you chose.',
  'They reply to you directly, using the details you gave.',
  'You can check progress with your reference code and this email address.',
];

export function EnquiryForm({
  providers,
  cityOptions,
  eventTypeOptions,
  policyVersion,
  initialValues,
}: EnquiryFormProps) {
  const [submitted, setSubmitted] = useState<SubmissionResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [slugInput, setSlugInput] = useState('');

  const providerNames = useMemo(
    () => new Map(providers.map((provider) => [provider.slug, provider.name])),
    [providers],
  );

  /**
   * The rules come from the API's own schema — nothing here restates a length,
   * format or bound. This wrapper only normalises the two shapes a browser
   * control produces but a JSON body does not (`''` for "empty", `null` for
   * "no date"), and adds one client-side condition.
   */
  const validateWithSchema = useMemo(() => schemaResolver(createEnquirySchema, { sync: true }), []);

  const form = useForm<EnquiryFormValues, EnquiryPayload>({
    initialValues: {
      listings: providers.map((provider) => provider.slug),
      contactName: initialValues?.contactName ?? '',
      contactEmail: initialValues?.contactEmail ?? '',
      contactPhone: initialValues?.contactPhone ?? '',
      contactCitySlug: initialValues?.contactCitySlug ?? '',
      contactMethod: initialValues?.contactMethod ?? 'EMAIL',
      eventTypeSlug: '',
      eventDate: null,
      eventDateFlexible: true,
      guestCount: '',
      budgetMin: '',
      budgetMax: '',
      requirements: '',
      consentPrivacy: false,
      companyWebsite: '',
    },
    validate: (values): FormErrors => {
      const errors = validateWithSchema({
        ...values,
        contactCitySlug: values.contactCitySlug || undefined,
        eventTypeSlug: values.eventTypeSlug || undefined,
        eventDate: values.eventDate || undefined,
        guestCount: values.guestCount === '' ? undefined : values.guestCount,
        budgetMin: values.budgetMin === '' ? undefined : values.budgetMin,
        budgetMax: values.budgetMax === '' ? undefined : values.budgetMax,
      });

      if (!values.eventDateFlexible && !values.eventDate) {
        errors.eventDate = 'Choose a date, or switch on “I haven’t decided yet”.';
      }

      return errors;
    },
    transformValues: (values): EnquiryPayload => {
      const guestCount = toOptionalNumber(values.guestCount);
      const budgetMin = toOptionalNumber(values.budgetMin);
      const budgetMax = toOptionalNumber(values.budgetMax);

      return {
        listings: values.listings,
        contactName: values.contactName.trim(),
        contactEmail: values.contactEmail.trim(),
        contactPhone: values.contactPhone.trim(),
        contactMethod: values.contactMethod,
        eventDateFlexible: values.eventDateFlexible,
        consentPrivacy: true,
        consentPolicyVersion: policyVersion,
        ...(values.contactCitySlug ? { contactCitySlug: values.contactCitySlug } : {}),
        ...(values.eventTypeSlug ? { eventTypeSlug: values.eventTypeSlug } : {}),
        ...(!values.eventDateFlexible && values.eventDate ? { eventDate: values.eventDate } : {}),
        ...(guestCount === undefined ? {} : { guestCount }),
        ...(budgetMin === undefined ? {} : { budgetMin }),
        ...(budgetMax === undefined ? {} : { budgetMax }),
        ...(values.requirements.trim() ? { requirements: values.requirements.trim() } : {}),
        ...(values.companyWebsite ? { companyWebsite: values.companyWebsite } : {}),
      };
    },
  });

  function addProvider() {
    const slug = slugInput.trim().toLowerCase();
    if (!slug) return;
    if (form.values.listings.includes(slug) || form.values.listings.length >= MAX_PROVIDERS) {
      setSlugInput('');
      return;
    }
    form.setFieldValue('listings', [...form.values.listings, slug]);
    form.clearFieldError('listings');
    setSlugInput('');
  }

  function removeProvider(slug: string) {
    form.setFieldValue(
      'listings',
      form.values.listings.filter((value) => value !== slug),
    );
    // The shortlist has changed, so a refusal recorded against the previous
    // shortlist is no longer about anything on screen.
    form.clearFieldError('listings');
  }

  async function handleSubmit(payload: EnquiryPayload) {
    setFormError(null);
    form.clearFieldError('listings');

    const key = deriveIdempotencyKey(payload);

    let response: Response;
    try {
      response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      setFormError('We could not reach the server. Check your connection and try again.');
      return;
    }

    const body = await readJson(response);

    if (response.ok && isSubmissionResult(body)) {
      setSubmitted({
        referenceCode: body.data.referenceCode,
        duplicate: body.data.duplicate,
      });
      return;
    }

    const error = readErrorBody(body);

    if (response.status === 400) {
      const details = error?.details;
      let mapped = 0;

      const applyFieldError = (field: string, message: string | undefined) => {
        if (!message || !(field in form.values) || HIDDEN_FIELDS.has(field)) return;
        form.setFieldError(field as keyof EnquiryFormValues, message);
        mapped += 1;
      };

      if (details?.fieldErrors) {
        for (const [field, messages] of Object.entries(details.fieldErrors)) {
          applyFieldError(field, messages?.[0]);
        }
      }

      /*
       * A service that reports `details.<field>` rather than Zod's envelope has
       * no per-field message, so the error's own message is the only thing that
       * can go on the field. It still goes *on the field*: a visitor who cannot
       * see which control was refused has to hunt the whole form.
       */
      if (mapped === 0 && details && typeof details === 'object') {
        for (const field of Object.keys(details)) {
          if (field === 'fieldErrors' || field === 'formErrors') continue;
          applyFieldError(field, error?.message);
        }
      }

      if (mapped === 0) {
        setFormError(error?.message ?? 'Some details were not accepted. Please check the form.');
      }
      return;
    }

    if (response.status === 409) {
      setFormError(
        error?.message ??
          'This enquiry has already been submitted. Check your email for the reference, or start a new enquiry.',
      );
      return;
    }

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('Retry-After'));
      setFormError(
        `${error?.message ?? 'You have sent several enquiries already.'}${retryGuidance(
          Number.isFinite(retryAfter) ? retryAfter : null,
        )}`,
      );
      return;
    }

    setFormError(
      error?.message ?? 'Something went wrong on our side. Your enquiry was not sent. Try again.',
    );
  }

  if (submitted) {
    return (
      <Surface
        tone={submitted.duplicate ? 'muted' : 'success'}
        padding="lg"
        className={cx(classes.result, submitted.duplicate && classes.resultDuplicate)}
      >
        <span className={classes.resultIcon} aria-hidden>
          {submitted.duplicate ? (
            <IconInfoCircle size="1.5rem" stroke={1.5} />
          ) : (
            <IconCircleCheck size="1.5rem" stroke={1.5} />
          )}
        </span>

        <h2 className={classes.resultTitle}>
          {submitted.duplicate ? 'This enquiry was already received' : 'Your enquiry has been sent'}
        </h2>

        <p className={classes.resultBody}>
          {submitted.duplicate ? (
            <>
              We already have this exact enquiry, so no new one was created. It keeps the same
              reference: <strong className={classes.reference}>{submitted.referenceCode}</strong>.
            </>
          ) : (
            <>
              Your reference is{' '}
              <strong className={classes.reference}>{submitted.referenceCode}</strong>. Keep it, and
              the email address you used, to check progress at any time.
            </>
          )}
        </p>

        <div className={classes.steps}>
          <h3 className={classes.stepsTitle}>What happens next</h3>
          <ol className={classes.stepList}>
            {NEXT_STEPS.map((step) => (
              <li key={step} className={classes.step}>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className={classes.resultActions}>
          <Button component={Link} href="/track" variant="default">
            Track this enquiry
          </Button>
        </div>
      </Surface>
    );
  }

  const atProviderLimit = form.values.listings.length >= MAX_PROVIDERS;
  const selectedCount = form.values.listings.length;

  return (
    <form className={classes.form} onSubmit={form.onSubmit(handleSubmit)} noValidate>
      <section aria-labelledby="enquiry-providers" className={classes.zone}>
        <Surface padding="lg" className={classes.panel}>
          <div className={classes.head}>
            <div className={classes.header}>
              <h2 id="enquiry-providers" className={classes.title}>
                Businesses you are contacting
              </h2>
              <div className={classes.badges}>
                {selectedCount > 0 ? (
                  <StatusBadge tone="neutral" variant="soft" size="sm">
                    {`${selectedCount} selected`}
                  </StatusBadge>
                ) : null}
                <StatusBadge tone="neutral" variant="outline" size="sm">
                  Required
                </StatusBadge>
              </div>
            </div>
            <p className={classes.note}>
              Your enquiry goes to these businesses only. You can add another by its page address.
            </p>
          </div>

          {selectedCount > 0 ? (
            <ul className={classes.shortlist} aria-label="Selected businesses">
              {form.values.listings.map((slug) => {
                const name = providerNames.get(slug);
                const label = name ?? slug;
                return (
                  <li key={slug} className={classes.shortlistItem}>
                    <span className={classes.marker} aria-hidden>
                      <IconBuildingStore size="1rem" stroke={1.5} />
                    </span>
                    <span className={classes.itemBody}>
                      <span className={name ? classes.itemName : classes.itemSlug}>{label}</span>
                      {name ? null : (
                        <span className={classes.itemMeta}>Unconfirmed page address</span>
                      )}
                    </span>
                    <button
                      type="button"
                      className={classes.remove}
                      onClick={() => removeProvider(slug)}
                      aria-label={`Remove ${label} from this enquiry`}
                    >
                      <IconX size="0.875rem" stroke={1.6} aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={classes.empty} role="status">
              No businesses selected yet. Add one below, or{' '}
              <Link className={classes.inlineLink} href="/vendors">
                browse vendors
              </Link>{' '}
              and send an enquiry from a profile.
            </p>
          )}

          {form.errors.listings ? (
            <p className={classes.fieldError} role="alert">
              <IconAlertTriangle
                className={classes.errorIcon}
                size="1rem"
                stroke={1.5}
                aria-hidden
              />
              {form.errors.listings}
            </p>
          ) : null}

          <div className={classes.addRow}>
            <TextInput
              label="Add a business by its page address"
              placeholder="e.g. gulmohar-banjara-banquets"
              value={slugInput}
              onChange={(event) => setSlugInput(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addProvider();
                }
              }}
              disabled={atProviderLimit}
              className={classes.addInput}
            />
            <Button
              type="button"
              variant="default"
              onClick={addProvider}
              disabled={atProviderLimit || slugInput.trim() === ''}
              leftSection={<IconPlus size="1rem" stroke={1.5} aria-hidden />}
            >
              Add
            </Button>
          </div>
          {atProviderLimit ? (
            <p className={classes.note}>
              You can enquire with up to {MAX_PROVIDERS} businesses at once.
            </p>
          ) : null}
        </Surface>
      </section>

      <section aria-labelledby="enquiry-contact" className={classes.zone}>
        <Surface padding="lg" className={classes.panel}>
          <div className={classes.head}>
            <div className={classes.header}>
              <h2 id="enquiry-contact" className={classes.title}>
                How the businesses can reach you
              </h2>
              <StatusBadge tone="neutral" variant="outline" size="sm">
                Required
              </StatusBadge>
            </div>
            <p className={classes.note}>
              Your name, email and phone are required — a business needs all three to reply.
            </p>
          </div>

          <div className={classes.fieldGrid}>
            <TextInput
              label="Your name"
              placeholder="Priya Nair"
              autoComplete="name"
              withAsterisk
              {...form.getInputProps('contactName')}
            />
            <TextInput
              label="Email"
              type="email"
              placeholder="priya@example.com"
              autoComplete="email"
              withAsterisk
              {...form.getInputProps('contactEmail')}
            />
            <TextInput
              label="Phone"
              placeholder="+91 90000 00001"
              autoComplete="tel"
              withAsterisk
              {...form.getInputProps('contactPhone')}
            />
            <Select
              label="Preferred contact method"
              data={[
                { value: 'EMAIL', label: 'Email' },
                { value: 'PHONE', label: 'Phone call' },
                { value: 'WHATSAPP', label: 'WhatsApp' },
              ]}
              allowDeselect={false}
              {...form.getInputProps('contactMethod')}
            />
          </div>

          <fieldset className={classes.fieldset}>
            <legend className={classes.legend}>
              <span className={classes.legendText}>About your event (optional)</span>
              <StatusBadge tone="neutral" variant="soft" size="sm">
                Optional
              </StatusBadge>
            </legend>
            <p className={classes.note}>
              Fill in what is relevant. A photographer does not need a guest count, and a venue does
              not need a shoot style — nothing here is required.
            </p>

            <div className={classes.fieldGrid}>
              <Select
                label="Event type"
                placeholder="Choose an event type"
                data={[...eventTypeOptions]}
                clearable
                {...form.getInputProps('eventTypeSlug')}
              />
              <Select
                label="City"
                placeholder="Where is the event?"
                data={[...cityOptions]}
                searchable
                clearable
                nothingFoundMessage="No city matches that"
                {...form.getInputProps('contactCitySlug')}
              />
            </div>

            <div className={classes.fieldGrid}>
              <div>
                <DatePickerInput
                  label="Event date"
                  placeholder="Pick a date"
                  valueFormat="D MMM YYYY"
                  clearable
                  disabled={form.values.eventDateFlexible}
                  {...form.getInputProps('eventDate')}
                />
                <Checkbox
                  className={classes.flexibleToggle}
                  label="I haven't decided yet"
                  {...form.getInputProps('eventDateFlexible', { type: 'checkbox' })}
                />
              </div>
              <NumberInput
                label="Approximate guest count"
                placeholder="450"
                min={1}
                max={200000}
                clampBehavior="none"
                thousandSeparator=","
                {...form.getInputProps('guestCount')}
              />
            </div>

            <div className={classes.fieldGrid}>
              <NumberInput
                label="Budget from (₹)"
                placeholder="800000"
                min={0}
                clampBehavior="none"
                thousandSeparator=","
                {...form.getInputProps('budgetMin')}
              />
              <NumberInput
                label="Budget to (₹)"
                placeholder="1500000"
                min={0}
                clampBehavior="none"
                thousandSeparator=","
                {...form.getInputProps('budgetMax')}
              />
            </div>

            <Textarea
              label="Anything the businesses should know"
              placeholder="An outdoor ceremony and an indoor reception, both at the same venue."
              rows={4}
              {...form.getInputProps('requirements')}
            />
          </fieldset>

          <section aria-labelledby="enquiry-consent" className={classes.consent}>
            <div className={classes.header}>
              <h2 id="enquiry-consent" className={classes.title}>
                Before you send
              </h2>
              <StatusBadge tone="neutral" variant="outline" size="sm">
                Required
              </StatusBadge>
            </div>

            <Checkbox
              label={
                <span>
                  I agree that Live Envt may share these details with the businesses I selected so
                  they can reply, and I accept the privacy terms (version {policyVersion}).
                </span>
              }
              {...form.getInputProps('consentPrivacy', { type: 'checkbox' })}
            />

            {formError ? (
              <p className={classes.fieldError} role="alert">
                <IconAlertTriangle
                  className={classes.errorIcon}
                  size="1rem"
                  stroke={1.5}
                  aria-hidden
                />{' '}
                {formError}
              </p>
            ) : null}

            <div className={classes.actions}>
              <Button
                type="submit"
                size="md"
                className={classes.submit}
                loading={form.submitting}
                leftSection={<IconSend size="1rem" stroke={1.5} aria-hidden />}
              >
                Send enquiry
              </Button>
              <p className={classes.actionsNote}>
                Businesses typically reply within two working days. You can track progress with your
                reference code.
              </p>
            </div>
          </section>

          {/* Honeypot. A real browser never fills this: it is visually hidden,
              unlabelled to assistive technology and removed from the tab order.
              A filled value is accepted by the API and stored as SPAM, so a bot
              has nothing to learn from the response. */}
          <div className="visually-hidden" aria-hidden="true">
            <TextInput
              label="Company website"
              tabIndex={-1}
              autoComplete="off"
              {...form.getInputProps('companyWebsite')}
            />
          </div>
        </Surface>
      </section>
    </form>
  );
}
