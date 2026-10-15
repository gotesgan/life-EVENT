'use client';

/**
 * A client-boundary re-export of `next/link`.
 *
 * Why this module exists: inside a Server Component, `next/link` resolves to a
 * plain function (`dist/client/app-dir/link.react-server.js`), which is **not** a
 * client reference. Passing a function across the server/client boundary is an
 * error — so `<Button component={Link}>` throws in any Server Component, because
 * Mantine's `Button` is a Client Component: *"Functions cannot be passed
 * directly to Client Components"*. Importing `Link` through a `'use client'`
 * module makes it a client reference, which is legal to pass as a prop.
 *
 * Import this instead of `next/link` in any file that hands a link component to
 * a Client Component (Mantine `Button`, `Anchor`, `NavLink`, `ActionIcon`, ...).
 * Plain `<Link href>` usage works identically, so there is no reason to use
 * `next/link` directly anywhere in this codebase.
 */
export { default } from 'next/link';
