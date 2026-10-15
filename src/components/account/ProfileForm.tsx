'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Checkbox, Select, TextInput } from '@mantine/core';
import { schemaResolver, useForm } from '@mantine/form';
import { z } from 'zod';
import { customerProfileUpdateSchema } from '@/lib/validation/account';
import { accountFetch, fieldErrorsFrom, notifyError, notifySuccess } from './api';
import { CONTACT_METHOD_OPTIONS, type ContactMethodValue } from './contact-method';
import classes from './ProfileForm.module.css';

interface ProfileValues {
  name: string;
  phone: string;
  citySlug: string | null;
  preferredContactMethod: ContactMethodValue;
  marketingConsent: boolean;
}

/**
 * The form schema is the API contract, with one presentation-side adjustment:
 * an empty phone input means "leave the number unchanged" (the contract uses
 * `undefined` for that), and `phoneSchema` correctly rejects `''`. Wrapping the
 * canonical schema keeps a single source of truth for every other rule — this is
 * still `customerProfileUpdateSchema` doing the validating.
 */
const profileFormSchema = z.preprocess((values) => {
  if (typeof values !== 'object' || values === null) return values;
  const phone = (values as { phone?: unknown }).phone;
  if (typeof phone === 'string' && phone.trim() === '') {
    return { ...(values as Record<string, unknown>), phone: undefined };
  }
  return values;
}, customerProfileUpdateSchema);

export interface ProfileFormProps {
  defaultValues: ProfileValues;
  /** City options resolved on the server from `listLocations({ type: 'CITY' })`. */
  cities: ReadonlyArray<{ value: string; label: string }>;
}

/**
 * Editable profile fields.
 *
 * Name, phone, city, preferred contact method and marketing consent are exactly
 * the fields `PATCH /api/account` accepts. Email, role and status are shown
 * read-only by the page — they are not rendered here at all, so there is no
 * disabled input for a customer to wonder about.
 *
 * The five fields are grouped into the two questions they actually answer —
 * who you are, and how you want to be reached — because the register here is
 * editorial: this is a page a customer fills in once and then leaves alone.
 */
export function ProfileForm({ defaultValues, cities }: ProfileFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const form = useForm<ProfileValues>({
    initialValues: defaultValues,
    validateInputOnBlur: true,
    validate: schemaResolver(profileFormSchema, { sync: true }),
  });

  const dirty = form.isDirty();

  async function save(values: ProfileValues) {
    setPending(true);

    const trimmedPhone = values.phone.trim();
    const payload = {
      name: values.name.trim(),
      // Empty means "keep the number on file": the contract accepts `undefined`,
      // not an empty string.
      phone: trimmedPhone === '' ? undefined : trimmedPhone,
      citySlug: values.citySlug,
      preferredContactMethod: values.preferredContactMethod,
      marketingConsent: values.marketingConsent,
    };

    try {
      await accountFetch('/api/account', { method: 'PATCH', body: JSON.stringify(payload) });
      notifySuccess('Your profile has been updated.', 'Saved');
      form.resetDirty();
      router.refresh();
    } catch (error) {
      const errors = fieldErrorsFrom(error);
      for (const [field, message] of Object.entries(errors)) {
        if (field in form.values) form.setFieldError(field, message);
      }
      notifyError(error, 'We could not save your profile');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={classes.form} onSubmit={form.onSubmit(save)} noValidate>
      <fieldset className={classes.group}>
        <legend className={classes.legend}>Your details</legend>

        <TextInput
          label="Your name"
          description="The name businesses see on the enquiries you send"
          autoComplete="name"
          required
          key={form.key('name')}
          {...form.getInputProps('name')}
        />

        <TextInput
          label="Phone"
          description="Used only for the enquiries you send. Include the country code. Leave blank to keep the number already on file."
          autoComplete="tel"
          inputMode="tel"
          key={form.key('phone')}
          {...form.getInputProps('phone')}
        />

        <Select
          label="City"
          description="Where you are usually based. It helps us show relevant businesses."
          placeholder="Choose a city"
          data={[...cities]}
          searchable
          clearable
          nothingFoundMessage="No city matches that name"
          key={form.key('citySlug')}
          {...form.getInputProps('citySlug')}
        />
      </fieldset>

      <fieldset className={classes.group}>
        <legend className={classes.legend}>Contact preferences</legend>

        <Select
          label="Preferred contact method"
          description="How businesses on your enquiries should reach you first."
          data={CONTACT_METHOD_OPTIONS.map((option) => ({ ...option }))}
          allowDeselect={false}
          key={form.key('preferredContactMethod')}
          {...form.getInputProps('preferredContactMethod')}
        />

        <Checkbox
          label="Email me occasional updates"
          description="Product news and vendor suggestions. Every email has an unsubscribe link, and this choice is stored with your profile."
          key={form.key('marketingConsent')}
          {...form.getInputProps('marketingConsent', { type: 'checkbox' })}
        />
      </fieldset>

      <div className={classes.actions}>
        <Button type="submit" loading={pending}>
          Save changes
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={() => {
            form.reset();
          }}
          disabled={pending}
        >
          Undo changes
        </Button>
        {/* Reserved space rather than a shifting row: the hint appears in a slot
            the actions already occupy. */}
        <p className={classes.dirty} role="status">
          {dirty ? 'Unsaved changes' : ''}
        </p>
      </div>
    </form>
  );
}
