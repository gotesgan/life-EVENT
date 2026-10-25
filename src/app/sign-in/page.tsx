import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SiteShell } from '@/components/layout/SiteShell';
import { AuthFormSkeleton, AuthShell } from './AuthShell';
import { SignInForm } from './SignInForm';

export const metadata: Metadata = {
  title: 'Sign in',
  description:
    'Sign in to Life Events to see the enquiries you have sent, their current stage, and the contact details you keep on file.',
  robots: { index: false, follow: true },
};

export default function SignInPage() {
  return (
    <SiteShell>
      <AuthShell
        title="Sign in"
        description="See every enquiry you have sent, where each one has reached, and the details you asked us to keep."
      >
        <Suspense fallback={<AuthFormSkeleton />}>
          <SignInForm />
        </Suspense>
      </AuthShell>
    </SiteShell>
  );
}
