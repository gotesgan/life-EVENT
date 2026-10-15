'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, PasswordInput, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import { safeNext, withNext } from '@/app/sign-in/next-param';
import classes from '@/app/sign-in/auth.module.css';

interface SignUpValues {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/**
 * Account creation.
 *
 * Posts `{ email, password, name }` to the documented Better Auth handler
 * (`POST /api/auth/sign-up/email`). `role` and `status` are declared
 * `input: false` on the server, so this form cannot ask for them even if it
 * tried — they are created with their server-owned defaults.
 *
 * There is no social sign-up and no "forgot password": neither exists on the
 * server, so neither appears here.
 */
export function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get('next'));

  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<SignUpValues>({
    initialValues: { name: '', email: '', password: '', confirmPassword: '' },
    validateInputOnBlur: true,
    validate: {
      name: (value) =>
        value.trim().length >= 2 ? null : 'Enter the name the businesses should use',
      email: (value) => (EMAIL_PATTERN.test(value.trim()) ? null : 'Enter a valid email address'),
      password: (value) =>
        value.length >= 8 ? null : 'Use at least 8 characters for your password',
      confirmPassword: (value, values) =>
        value === values.password ? null : 'Both passwords must match',
    },
  });

  async function signUp(values: SignUpValues) {
    setPending(true);
    setFormError(null);

    let response: Response;
    try {
      response = await fetch('/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: values.email.trim(),
          password: values.password,
          name: values.name.trim(),
        }),
      });
    } catch {
      setFormError('We could not reach the server. Check your connection and try again.');
      setPending(false);
      return;
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      setFormError(
        body?.message ?? 'We could not create that account. Check the details above and try again.',
      );
      setPending(false);
      return;
    }

    // `autoSignIn` is enabled on the server, so the session cookie is already
    // set and the account pages will resolve immediately.
    router.push(next);
    router.refresh();
  }

  return (
    <>
      <form className={classes.form} onSubmit={form.onSubmit(signUp)} noValidate>
        {formError ? (
          <p className={classes.formError} role="alert">
            <IconAlertCircle className={classes.formErrorIcon} size={18} stroke={1.5} aria-hidden />
            {formError}
          </p>
        ) : null}

        <TextInput
          label="Your name"
          description="Businesses see this name on the enquiries you send"
          autoComplete="name"
          required
          key={form.key('name')}
          {...form.getInputProps('name')}
        />

        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
          required
          key={form.key('email')}
          {...form.getInputProps('email')}
        />

        <PasswordInput
          label="Password"
          description="At least 8 characters"
          autoComplete="new-password"
          required
          key={form.key('password')}
          {...form.getInputProps('password')}
        />

        <PasswordInput
          label="Confirm password"
          autoComplete="new-password"
          required
          key={form.key('confirmPassword')}
          {...form.getInputProps('confirmPassword')}
        />

        <Button type="submit" fullWidth loading={pending} loaderProps={{ type: 'dots' }}>
          Create account
        </Button>
      </form>

      <p className={classes.switch}>
        Already have an account?{' '}
        <Link className={classes.switchLink} href={withNext('/sign-in', next)}>
          Sign in
        </Link>
      </p>

      <p className={classes.note}>
        We store your name, email and password, plus any profile details you add later. Read the{' '}
        <Link className={classes.switchLink} href="/privacy">
          privacy notice
        </Link>{' '}
        and the{' '}
        <Link className={classes.switchLink} href="/terms">
          terms
        </Link>
        .
      </p>
    </>
  );
}
