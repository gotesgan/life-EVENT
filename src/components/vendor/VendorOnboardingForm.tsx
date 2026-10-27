'use client';

import { useMemo, useState } from 'react';
import { Select, Textarea, TextInput } from '@mantine/core';
import { schemaResolver, useForm, type FormErrors } from '@mantine/form';
import { IconCircleCheck, IconSend } from '@tabler/icons-react';
import { Button } from '@/components/ui';
import { Surface } from '@/components/ui';
import { vendorOnboardingSchema } from '@/lib/validation/vendor-invite';
import classes from './VendorOnboardingForm.module.css';

export interface OnboardingOption {
  value: string;
  label: string;
}

export interface VendorOnboardingFormProps {
  token: string;
  vendorTypes: readonly OnboardingOption[];
  cities: readonly OnboardingOption[];
  defaults?: {
    businessName?: string | null;
    contactEmail?: string | null;
    vendorType?: string | null;
  };
}

interface FormValues {
  businessName: string;
  vendorType: string;
  citySlug: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  websiteUrl: string;
  description: string;
  companyWebsite: string;
}

/**
 * The vendor's own listing form, reached from the invite link.
 *
 * One page rather than a wizard: the fields are few, and a vendor filling this
 * in on a phone is better served by seeing everything that will be asked than by
 * discovering step three after typing an address. Required fields are exactly
 * the ones the review screen needs to create a listing draft.
 */
export function VendorOnboardingForm({
  token,
  vendorTypes,
  cities,
  defaults,
}: VendorOnboardingFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const validateWithSchema = useMemo(
    () => schemaResolver(vendorOnboardingSchema, { sync: true }),
    [],
  );

  const form = useForm<FormValues>({
    initialValues: {
      businessName: defaults?.businessName ?? '',
      vendorType: defaults?.vendorType ?? '',
      citySlug: '',
      contactName: '',
      contactPhone: '',
      contactEmail: defaults?.contactEmail ?? '',
      websiteUrl: '',
      description: '',
      companyWebsite: '',
    },
    validate: (values): FormErrors =>
      validateWithSchema({ ...values, token, websiteUrl: values.websiteUrl.trim() }),
  });

  async function handleSubmit(values: FormValues) {
    setFormError(null);
    setPending(true);

    let response: Response;
    try {
      response = await fetch('/api/vendor-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          token,
          websiteUrl: values.websiteUrl.trim(),
          companyWebsite: values.companyWebsite || undefined,
        }),
      });
    } catch {
      setPending(false);
      setFormError('We could not reach the server. Check your connection and try again.');
      return;
    }

    const body = await response.json().catch(() => null);
    setPending(false);

    if (response.ok) {
      setSubmitted(true);
      return;
    }

    if (response.status === 400) {
      const fieldErrors = body?.error?.details?.fieldErrors as
        Record<string, string[] | undefined> | undefined;
      let mapped = 0;
      for (const [field, messages] of Object.entries(fieldErrors ?? {})) {
        if (!messages?.[0] || !(field in form.values)) continue;
        form.setFieldError(field as keyof FormValues, messages[0]);
        mapped += 1;
      }
      setFormError(
        mapped > 0
          ? null
          : (body?.error?.message ?? 'Some details were not accepted. Please check the form.'),
      );
      return;
    }

    setFormError(body?.error?.message ?? 'Your details were not saved. Please try again.');
  }

  if (submitted) {
    return (
      <Surface tone="success" padding="lg" className={classes.result}>
        <span className={classes.resultIcon} aria-hidden>
          <IconCircleCheck size="1.75rem" stroke={1.5} />
        </span>
        <h2 className={classes.resultTitle}>Details received</h2>
        <p className={classes.resultBody}>
          Thank you. The team reviews the submission and will publish your listing after checking
          the prices and photos. Reply to the email you received if anything changes.
        </p>
      </Surface>
    );
  }

  return (
    <form className={classes.form} onSubmit={form.onSubmit(handleSubmit)} noValidate>
      <div className={classes.grid}>
        <TextInput
          label="Business name"
          placeholder="e.g. Gulmohar Banquets"
          withAsterisk
          autoComplete="organization"
          {...form.getInputProps('businessName')}
        />

        <Select
          label="Type of vendor"
          placeholder="What kind of business is this?"
          withAsterisk
          data={vendorTypes}
          searchable
          nothingFoundMessage="No matching category"
          {...form.getInputProps('vendorType')}
        />

        <Select
          label="City"
          placeholder="Where do you operate?"
          withAsterisk
          data={cities}
          searchable
          nothingFoundMessage="No matching city"
          {...form.getInputProps('citySlug')}
        />

        <TextInput
          label="Contact person"
          placeholder="Who should we speak to?"
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
          {...form.getInputProps('contactPhone')}
        />

        <TextInput
          label="Email"
          placeholder="you@business.com"
          withAsterisk
          type="email"
          autoComplete="email"
          {...form.getInputProps('contactEmail')}
        />

        <TextInput
          label="Website (optional)"
          placeholder="https://"
          autoComplete="url"
          {...form.getInputProps('websiteUrl')}
        />
      </div>

      <Textarea
        label="What do you offer?"
        description="Services, packages, capacity, anything a customer should know. This becomes the first draft of your listing description."
        placeholder="Banquet hall for 150–400 guests, in-house catering, valet parking…"
        withAsterisk
        minRows={6}
        autosize
        maxRows={12}
        {...form.getInputProps('description')}
      />

      {/* Honeypot — visually hidden, skipped by the tab order. */}
      <div className={classes.honeypot} aria-hidden>
        <label htmlFor="onboarding-company-website">Company website</label>
        <input
          id="onboarding-company-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...form.getInputProps('companyWebsite')}
        />
      </div>

      {formError ? <p className={classes.formError}>{formError}</p> : null}

      <Button type="submit" loading={pending} leftSection={<IconSend size="1rem" stroke={1.75} />}>
        Send my details
      </Button>
    </form>
  );
}
