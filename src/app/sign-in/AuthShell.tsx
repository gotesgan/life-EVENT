import type { ReactNode } from 'react';
import { Skeleton } from '@mantine/core';
import { BrandMark, Container, Surface } from '@/components/ui';
import classes from './auth.module.css';

export interface AuthShellProps {
  title: string;
  description: ReactNode;
  children: ReactNode;
}

/**
 * The frame shared by `/sign-in` and `/sign-up`.
 *
 * Both routes are one card with a brand mark, a single `<h1>` and a form. It is
 * a Server Component so the static part of the card is in the initial HTML; only
 * the form itself (which reads `?next=` and posts to the auth handler) is a
 * Client Component.
 */
export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <Container className={classes.wrap}>
      <Surface padding="lg" className={classes.card}>
        <div className={classes.brand}>
          <BrandMark size="md" />
        </div>
        <h1 className={classes.title}>{title}</h1>
        <p className={classes.description}>{description}</p>
        {children}
      </Surface>
    </Container>
  );
}

/**
 * Shown while the client form hydrates.
 *
 * `useSearchParams` always needs a `<Suspense>` boundary under Cache Components;
 * this mirrors the real form's box model so the card does not resize when the
 * form takes over.
 */
export function AuthFormSkeleton() {
  return (
    <div className={classes.skeleton} aria-hidden>
      <Skeleton height={60} radius="md" />
      <Skeleton height={60} radius="md" />
      <Skeleton height={44} radius="md" />
    </div>
  );
}
