'use client';

import Link from '@/components/ui/ClientLink';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { ErrorState } from '@/components/ui/ErrorState';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  /** Next 16's stable retry callback — `reset` is deprecated in favour of this. */
  retry: () => void;
}

/**
 * Root error boundary.
 *
 * This is a Client Component, so it cannot compose `SiteShell` — the header reads
 * the session through a `server-only` module. It therefore supplies its own
 * `<main>` landmark and skip target, and keeps the chrome-free layout deliberate:
 * when a page fails, the least confusing thing to show is one clear message.
 *
 * The error message itself is never rendered. It can contain internal detail, and
 * it is not the visitor's problem; only Next's opaque `digest` is shown, because
 * that is the one value support can correlate with the server logs.
 */
export default function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <Container as="main" id="main-content">
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          paddingBlock: 'clamp(2.5rem, 6vw, 6rem)',
        }}
      >
        {/*
          `ErrorState` deliberately renders its title as a paragraph, so this page
          supplies its own heading to keep the document outline valid. It repeats
          the visible words once, for assistive technology only.
        */}
        <h1 className="visually-hidden">Something went wrong on our side</h1>
        <ErrorState
          title="Something went wrong on our side"
          description={
            <>
              <span>
                This page could not be built. It is a fault in our application, not something you
                did. Trying again often works; if it does not, the homepage always will.
              </span>
              {error.digest ? (
                <span
                  style={{
                    display: 'block',
                    marginBlockStart: 'var(--app-stack-gap)',
                    color: 'var(--app-text-subtle)',
                    fontFamily: 'var(--mantine-font-family-monospace)',
                    fontSize: 'var(--text-caption-size)',
                  }}
                >
                  Reference: {error.digest}
                </span>
              ) : null}
            </>
          }
          onRetry={retry}
          secondaryAction={
            <Button component={Link} href="/" variant="secondary">
              Go to the homepage
            </Button>
          }
        />
      </div>
    </Container>
  );
}
