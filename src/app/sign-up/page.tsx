import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SiteShell } from '@/components/layout/SiteShell';
import { AuthFormSkeleton, AuthShell } from '@/app/sign-in/AuthShell';
import { SignUpForm } from './SignUpForm';

export const metadata: Metadata = {
  title: 'Create an account',
  description:
    'Create a Live Envt account to keep track of every enquiry you send and the contact details you asked us to hold.',
  robots: { index: false, follow: true },
};

export default function SignUpPage() {
  return (
    <SiteShell>
      <AuthShell
        title="Create an account"
        description="An account keeps every enquiry in one place. You can still track a single enquiry with its reference code and email, without an account."
      >
        <Suspense fallback={<AuthFormSkeleton />}>
          <SignUpForm />
        </Suspense>
      </AuthShell>
    </SiteShell>
  );
}
