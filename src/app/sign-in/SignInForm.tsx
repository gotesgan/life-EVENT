'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, PasswordInput, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import { safeNext, withNext } from './next-param';
import classes from './auth.module.css';

interface SignInValues {
  email: string;
  password: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/**
 * Sign-in form.
 *
 * Posts the documented Better Auth contract
 * (`POST /api/auth/sign-in/email`, `{ email, password }`) and navigates with
 * `router.push(next)` on success. There is deliberately no social login and no
 * password-reset link: neither is implemented, and a control that cannot work is
 * worse than no control.
 *
 * A failed sign-in never says whether the address exists — every credential
 * failure produces the same sentence. The only server message that is surfaced
 * verbatim is a rate-limit notice, which is about the request, not the account.
 */
export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get('next'));

  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<SignInValues>({
    initialValues: { email: '', password: '' },
    validateInputOnBlur: true,
    validate: {
      email: (value) => (EMAIL_PATTERN.test(value.trim()) ? null : 'Enter a valid email address'),
      password: (value) => (value.length >= 8 ? null : 'Your password is at least 8 characters'),
    },
  });

  async function signIn(values: SignInValues) {
    setPending(true);
    setFormError(null);

    let response: Response;
    try {
      response = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: values.email.trim(), password: values.password }),
      });
    } catch {
      setFormError('We could not reach the server. Check your connection and try again.');
      setPending(false);
      return;
    }

    if (!response.ok) {
      // 429 is about the request rate, so its message is safe to show. Anything
      // else could disclose whether the address has an account.
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      setFormError(
        response.status === 429
          ? (body?.message ?? 'Too many attempts. Wait a minute and try again.')
          : 'Email or password is incorrect. Check both and try again.',
      );
      setPending(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <>
      <form className={classes.form} onSubmit={form.onSubmit(signIn)} noValidate>
        {formError ? (
          <p className={classes.formError} role="alert">
            <IconAlertCircle className={classes.formErrorIcon} size={18} stroke={1.5} aria-hidden />
            {formError}
          </p>
        ) : null}

        <TextInput
          label="Email"
          description="The address you used when you sent an enquiry"
          type="email"
          autoComplete="email"
          required
          key={form.key('email')}
          {...form.getInputProps('email')}
        />

        <PasswordInput
          label="Password"
          autoComplete="current-password"
          required
          key={form.key('password')}
          {...form.getInputProps('password')}
        />

        <Button type="submit" fullWidth loading={pending} loaderProps={{ type: 'dots' }}>
          Sign in
        </Button>
      </form>

      <p className={classes.switch}>
        New here?{' '}
        <Link className={classes.switchLink} href={withNext('/sign-up', next)}>
          Create an account
        </Link>
      </p>

      <p className={classes.note}>
        Password reset is not available yet. If you lose your password, contact us and we will help
        you regain access.
      </p>
    </>
  );
}
