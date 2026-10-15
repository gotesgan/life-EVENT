import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth/server';

/**
 * Better Auth catch-all handler: sign-up, sign-in, sign-out, session refresh.
 *
 * Route Handlers are used rather than Server Actions so authentication is
 * reachable from the browser, from tests and from any future non-browser client
 * through one documented HTTP contract.
 */
export const { GET, POST } = toNextJsHandler(auth.handler);
