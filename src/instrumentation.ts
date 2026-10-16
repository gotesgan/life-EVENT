/**
 * Server bootstrap — validate configuration on the way up, not on the way out.
 *
 * ## The defect this exists to fix
 *
 * `getServerEnv()` was only ever called lazily, from inside request handling.
 * When a required variable was wrong, the failure therefore surfaced *per
 * request*, and on a page route it surfaced **after the response had already
 * started streaming**: with `cacheComponents` the static shell is flushed with
 * `200`, the dynamic part then threw, and the client received a `200` with a
 * **zero-byte body** and only a server-side log to explain it. A deploy with a
 * 13-character `IP_HASH_SALT` served that way on every page.
 *
 * That is the worst possible failure shape. A 500 is honest, a blank 200 looks
 * like a network problem, and nothing in monitoring catches it — the status code
 * is a success.
 *
 * ## What this does, measured
 *
 * `register()` runs before any request is handled, so the configuration is
 * validated on the way up rather than discovered on the way out. Verified by
 * running the exact original defect (a 13-character `IP_HASH_SALT`) against a
 * production build:
 *
 *   | | before | after |
 *   | --- | --- | --- |
 *   | status | `200` | **`500`** |
 *   | body | **0 bytes** | a short error page |
 *   | operator log | one line per request | an actionable block naming the variable |
 *
 * Valid configuration is unaffected — `getServerEnv()` memoises, so this simply
 * warms the cache the request path then reuses.
 *
 * **What it does not do.** Throwing here does *not* stop Next from accepting
 * connections; the failure is logged and the requests that subsequently read
 * configuration are answered with a 500. So this is *fail-loud*, not
 * *fail-closed*: a misconfigured deploy is now obvious to both a monitor and a
 * human, but a platform health check pointed at `/` will still see a server that
 * answers. Making it truly fail-closed would need the entrypoint to exit, which
 * is a deployment-contract decision rather than a code one — recorded here so
 * nobody assumes a stronger guarantee than exists.
 *
 * Note the division of responsibility: the **API** layer already returns a
 * generic `500 INTERNAL_ERROR` for an unexpected throw and keeps the internal
 * message out of the response body. That is unchanged; this adds a failure that
 * is loud before it is reached.
 *
 * ## Why the runtime check
 *
 * Next runs instrumentation in more than one runtime. Configuration is a
 * Node.js-server concern, and the edge runtime has neither these variables nor
 * this failure mode; skipping it there avoids a false failure.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Imported lazily so the edge runtime never evaluates the config module.
  const { getServerEnv } = await import('@/lib/env');

  try {
    getServerEnv();
  } catch (error) {
    // Log the real reason — it is the whole point, and it goes to the operator's
    // log stream, not to a response body. The wording claims only what happens:
    // the process keeps serving, so the message must not say it failed to start.
    console.error(
      [
        '',
        '  Fatal: the server configuration is invalid.',
        '',
        error instanceof Error ? error.message : String(error),
        '',
        '  Fix the variables above and restart. The process keeps accepting',
        '  connections, so until then any request that reads configuration fails',
        '  loudly — which is the point: a 5xx an operator can see, rather than the',
        '  200 with a zero-byte body this misconfiguration used to produce.',
        '',
      ].join('\n'),
    );

    // Rethrow so the failure is not swallowed. This does not stop the server
    // from accepting connections (see the note on fail-loud vs fail-closed), but
    // it is recorded against the server instead of being a log line nobody
    // reads, and a request that then reads configuration fails as a 5xx rather
    // than a blank 200.
    throw error;
  }
}
