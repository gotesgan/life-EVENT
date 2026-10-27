<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Life Events — engineering notes

A two-sided marketplace for wedding and event vendors in India, with published prices.
The public side browses vendors by category and city, shows a vendor profile, sends an
enquiry and tracks it by reference code. The admin side covers moderation, the
catalogue, enquiry triage and an audit log.

## Stack

| Concern   | Choice                                                                 |
| --------- | ---------------------------------------------------------------------- |
| Framework | Next.js 16.4 (App Router, Turbopack, `cacheComponents: true` → PPR)     |
| UI        | React 19.3, Mantine 9.7, CSS Modules, `@tabler/icons-react`            |
| Data      | PostgreSQL through Prisma 7.10 (`@prisma/adapter-pg`)                  |
| Auth      | `better-auth`; read the current actor via `src/lib/auth/actor.ts`       |
| Validation| Zod 4 schemas in `src/lib/validation`                                  |
| Storage   | Cloudflare R2 (S3 API) with a local-driver fallback                    |
| Tests     | Vitest 5 (unit / component / integration) + Playwright e2e             |
| Toolchain | pnpm 9, Node ≥ 24, ESLint 9, Prettier 3                                |

There is no Tailwind, no shadcn and no animation library. Mantine plus CSS Modules is
the whole styling story. Do not add a dependency without asking first — the styling and
test stacks were chosen deliberately and the Mantine migration notes are in
`docs/mantine-9-notes.md`.

## Commands

| Command                    | What it does                                                  |
| -------------------------- | ------------------------------------------------------------- |
| `pnpm dev`                 | Dev server on :3000                                           |
| `pnpm build`               | Production build (also the PPR/prerender check)               |
| `pnpm check`               | `format:check` → `lint` → `typecheck` → all Vitest projects    |
| `pnpm typecheck`           | `tsc --noEmit`                                                |
| `pnpm lint` / `lint:fix`   | ESLint / ESLint with `--fix`                                   |
| `pnpm format` / `format:check` | Prettier write / Prettier check                           |
| `pnpm test:unit`           | Vitest `unit` project (Node, no DB)                           |
| `pnpm test:component`      | Vitest `component` project (jsdom, no DB)                     |
| `pnpm test:integration`    | Vitest `integration` project (needs the test database)        |
| `pnpm test`                | All three Vitest projects                                     |
| `pnpm e2e`                 | Playwright; `pnpm e2e:install` once to get Chromium           |
| `pnpm db:generate`         | Prisma client into `src/generated/prisma` (gitignored)        |
| `pnpm db:migrate` / `db:reset` / `db:seed` | Schema and seed data management            |

A change is not finished until `pnpm format:check`, `pnpm lint`, `pnpm typecheck` and
`pnpm test` are clean. Warnings are not acceptable either — keep lint output empty.

## Layout

| Path                              | Contents                                                     |
| --------------------------------- | ------------------------------------------------------------ |
| `src/app`                         | Routes. Server Components by default.                        |
| `src/app/api`                     | Route handlers (`route.ts`); admin catalogue lives here too. |
| `src/components/layout`           | Header, footer, shell, navigation data model.                |
| `src/components/ui`               | Shared primitives plus the `ClientLink` re-export.           |
| `src/components/{listing,filters,enquiry,account,admin}` | Feature UI.                |
| `src/server/{domain,dto,repositories,services}` | Server-side data access and business rules.   |
| `src/lib`                         | `auth`, `storage`, `validation`, `api` helpers, `env`, `db`. |
| `src/theme`                       | Mantine theme, design tokens, CSS-variable resolver.         |
| `src/generated/prisma`            | Generated Prisma client (gitignored).                        |
| `prisma`                          | `schema.prisma`, migrations, `seed.ts`, `seed-data`.         |
| `tests/{unit,component,integration,api}` | Vitest suites (`api` runs inside the integration project). |
| `tests/e2e`                       | Playwright specs.                                            |
| `scripts`                         | Dev and maintenance scripts (`tsx`).                         |
| `docs`                            | Authoritative design, research and review documents.         |

Public pages read through `src/server/services` and `src/server/repositories`. The admin
area predates that layer and still reads Prisma from co-located `_lib` modules and route
handlers; put new work in `src/server` instead.

## Conventions

- **Server vs client.** Server Components are the default. Add `'use client'` only for
  state, effects, event handlers or browser APIs, and keep the boundary as low in the
  tree as possible. Data modules that must never reach the client import
  `server-only`.
- **Styling.** Use design tokens from `src/theme/tokens.ts` through CSS Modules
  (`.module.css`) rather than hard-coded colours, spacing or radii. Prefer
  `@mixin larger-than $mantine-breakpoint-lg` / `smaller-than` over raw media queries so
  breakpoints stay consistent. Mantine props are fine for layout primitives; reach for a
  CSS Module when you need selectors, pseudo-elements or transitions.
- **Accessibility is not optional.** Every interactive element needs an accessible name,
  a visible focus state and a non-colour way to convey state. Check contrast against
  WCAG AA (4.5:1 body text, 3:1 UI) before choosing a colour.
- **Navigation has one source of truth.** `src/components/layout/navigation.ts` holds
  the routes; a new nav surface must derive its destinations from it rather than
  restate them. For "which item is the current page", use `activeSectionId()` (the
  header) or `currentNavHref()` (flat surfaces such as the drawer) instead of
  `pathname.startsWith(href)` — the naive test marks two items current on overlapping
  routes and leaves two `aria-current="page"` links on one page.
- **Comments explain why, not what.** Match the surrounding density; the existing code
  documents non-obvious decisions and leaves self-evident code alone.
- **Types.** `strict` is on, but `noUncheckedIndexedAccess` is off — do not sprinkle
  non-null assertions to satisfy the compiler.
- **Nothing on the DB path is guessed.** Money and dates have documented formats, and
  filter/query contracts live in `src/lib/validation`.

## Next.js 16 specifics

- `cacheComponents: true` means pages are partially prerendered. A client component that
  reads `usePathname()`, `useSearchParams()` or similar must sit inside `<Suspense>`.
- **A `<Suspense>` fallback is part of the prerendered shell**, so it must be hook-free
  too — a fallback that calls `usePathname()` fails the build with a
  `CLIENT_HOOK_DYNAMIC` digest. The pattern used throughout is a hook-free view
  component, a thin client wrapper that owns the hook, and a hook-free fallback.
- Run `pnpm build` when a change touches routing, Suspense boundaries or
  `use client` placement; typecheck and lint will not catch these failures.

## Testing

Vitest is split into three projects (`vitest.config.mts`) so that fast tests never need a
database:

- **`unit`** — `tests/unit/**/*.test.ts`, Node, pure logic and services with stubs.
- **`component`** — `tests/component/**/*.test.tsx`, jsdom via `@vitejs/plugin-react`,
  shared setup in `tests/setup/component.ts` (stubs `matchMedia`, `ResizeObserver`,
  scrolling). Mock `next/navigation` and `next/link`; use `vi.hoisted` when a test needs
  to move the visitor to another pathname mid-test.
- **`integration`** — `tests/integration/**` and `tests/api/**`, real PostgreSQL, shared
  setup, `fileParallelism: false`.

`docs/testing-strategy.md` explains the isolation strategy and its trade-offs. One
practical caveat: Mantine's popover dropdown applies an inline `display: none` while
floating-ui reports its trigger as `referenceHidden`, and jsdom measures every element as
zero-sized, so that middleware always fires under test. Query inside the mounted dropdown
(`hidden: true`) and say why in a comment rather than "fixing" it — the panel is visible
in a browser.

## Workflow

1. Branch per task off `main`, named `type/short-slug` (e.g.
   `fix/p0-header-contrast-and-tokens`). Never commit to `main` directly.
2. Do the work; get `pnpm check` green.
3. Review the branch diff before merging. Fix review findings in new commits rather than
   amending published ones.
4. Merge into `main` with `--no-ff` and a `merge: …` subject, matching the history.
5. There is no git remote — every merge so far is local, so never push and never rewrite
   `main`.

Commit subjects use conventional prefixes (`feat(scope):`, `fix(scope):`, `docs(scope):`,
`chore:`, `merge:`) with a body that explains the reasoning, not the diff.

## Environment

- `.env` and `.dev-env.sh` are gitignored and hold real secrets. Never print them, never
  commit them, never copy a value into source or a test fixture.
- `src/lib/env.ts` validates configuration through `hardenedEnvSchema`. Development is
  forgiving; `next start` refuses to boot on placeholder values
  (`BETTER_AUTH_SECRET`, `IP_HASH_SALT` ≥ 16 chars, `R2_BUCKET`), and setting those
  inline often will not override `.env`.
- The dev database is `liveenvt_dev`. `psql` rejects a Prisma URL containing
  `?schema=public` with `invalid URI query parameter: "schema"` — strip that parameter.
- Image work runs on macOS built-ins (`sips`, `jq`, `curl`), `tsx`, a small HTML page
  driven by Playwright, or the bundled Python (Pillow) returned by
  `load_workspace_dependencies` — use that for keying, cropping and resizing brand
  assets. There is no ImageMagick.
- `prisma generate` must run before typecheck after a schema change, because
  `src/generated` is gitignored.

## Docs worth reading first

- `docs/system-design.md`, `docs/database-design.md`, `docs/api-design.md` — architecture
  and contracts.
- `docs/design-system.md`, `docs/master-ui-redesign-plan.md` — the visual system and the
  agreed redesign plan.
- `docs/nextjs-16-notes.md`, `docs/mantine-9-notes.md`, `docs/prisma-7-notes.md` —
  version-specific behaviour captured from the bundled docs.
- `docs/testing-strategy.md`, `docs/security.md` — how the suites isolate themselves, and
  the security posture.
- `docs/research/` — audits and independent review notes.
