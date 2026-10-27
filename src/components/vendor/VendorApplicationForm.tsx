'use client';

import { useMemo, useState } from 'react';
import { Select, Textarea, TextInput } from '@mantine/core';
import { schemaResolver, useForm, type FormErrors } from '@mantine/form';
import { IconCircleCheck, IconSend } from '@tabler/icons-react';
import { Button } from '@/components/ui';
import { Surface } from '@/components/ui';
import {
  createVendorApplicationSchema,
  type CreateVendorApplicationInput,
} from '@/lib/validation/vendor-application';
import classes from './VendorApplicationForm.module.css';

export interface VendorTypeOption {
  value: string;
  label: string;
}

export interface VendorApplicationFormProps {
  /** Leaf catalogue categories, as `{ value: slug, label: name }`. */
  vendorTypes: readonly VendorTypeOption[];
}

interface FormValues {
  businessName: string;
  vendorType: string;
  contactPhone: string;
  description: string;
  companyWebsite: string;
}

/**
 * The vendor registration form.
 *
 * Three fields plus a description — the brief is explicit that this is a first
 * contact, not onboarding. The vendor type is a real catalogue category, so an
 * accepted application can be turned into a listing without re-keying it.
 *
 * Nothing is stored until submit; on failure the server's field errors are mapped
 * back onto the input that caused them, so a corrected application does not have
 * to be re-read from the top.
 */
export function VendorApplicationForm({ vendorTypes }: VendorApplicationFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const validateWithSchema = useMemo(
    () => schemaResolver(createVendorApplicationSchema, { sync: true }),
    [],
  );

  const form = useForm<FormValues>({
    initialValues: {
      businessName: '',
      vendorType: '',
      contactPhone: '',
      description: '',
      companyWebsite: '',
    },
    validate: (values): FormErrors => validateWithSchema(values),
  });

  async function handleSubmit(values: FormValues) {
    setFormError(null);
    setPending(true);

    const payload: CreateVendorApplicationInput = {
      businessName: values.businessName.trim(),
      vendorType: values.vendorType,
      contactPhone: values.contactPhone.trim(),
      description: values.description.trim(),
      companyWebsite: values.companyWebsite || undefined,
    };

    let response: Response;
    try {
      response = await fetch('/api/vendor-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
          : (body?.error?.message ?? 'Some details were not accepted. Please check the form.'),
      );
      return;
    }

    setFormError(
      body?.error?.message ?? 'Something went wrong on our side. Your application was not sent.',
    );
  }

  if (submitted) {
    return (
      <Surface tone="success" padding="lg" className={classes.result}>
        <span className={classes.resultIcon} aria-hidden>
          <IconCircleCheck size="1.75rem" stroke={1.5} />
        </span>
        <h2 className={classes.resultTitle}>Application received</h2>
        <p className={classes.resultBody}>
          Thank you — the team reviews new businesses and will call the number you gave. Nothing
          else is needed from you right now.
        </p>
      </Surface>
    );
  }

  return (
    <form className={classes.form} onSubmit={form.onSubmit(handleSubmit)} noValidate>
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

      <Textarea
        label="Describe your business"
        placeholder="What you offer, where you work, and the price band your customers usually book in."
        withAsterisk
        autosize
        minRows={4}
        maxLength={2000}
        description="Two or three sentences is enough. Include the services you are best known for."
        {...form.getInputProps('description')}
      />

      {/* Honeypot: off-screen, unlabelled, out of the tab order. */}
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
        size="md"
        fullWidth
        data-tour="vendor-form-submit"
        loading={pending}
        leftSection={<IconSend size="1rem" stroke={1.6} aria-hidden />}
      >
        Send application
      </Button>

      <p className={classes.footnote}>
        No fee to apply. Listing is free while the marketplace is in its launch catalogue.
      </p>
    </form>
  );
}
