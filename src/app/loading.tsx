import { Skeleton } from '@mantine/core';
import { SiteShell } from '@/components/layout/SiteShell';
import { Container } from '@/components/ui/Container';
import { ListingGridSkeleton } from '@/components/ui/Skeletons';

/**
 * Root page-level loading state.
 *
 * It renders the same shell and the same card grid the real pages use, and the
 * title block is sized from the *type tokens* rather than from hand-picked
 * pixels, so the fallback tracks the real `PageHeader` when the scale changes.
 * The title block is `aria-hidden` and the grid carries the single
 * `role="status"` announcement, so a screen reader hears one "loading", not a
 * dozen empty boxes.
 *
 * This is the fallback for the whole route tree, which is dominated by the
 * public browse surfaces; admin and account routes ship their own boundaries
 * where their density differs.
 */
export default function Loading() {
  return (
    <SiteShell>
      <Container>
        <div style={{ paddingBlock: 'var(--app-section-gap) 0' }}>
          <div
            aria-hidden
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--app-stack-gap)',
              marginBlockEnd: 'var(--app-section-gap)',
            }}
          >
            <Skeleton height="var(--text-h1-size)" width="44%" radius="sm" />
            <Skeleton height="var(--text-secondary-size)" width="64%" radius="sm" />
          </div>

          <ListingGridSkeleton count={6} />
        </div>
      </Container>
    </SiteShell>
  );
}
