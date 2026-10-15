# Prisma 7 (7.10.0) — verified setup notes for Next.js 16 + TypeScript

Scope: `prisma@7.10.0` and `@prisma/client@7.10.0` as installed in this repo, plus the
official Prisma ORM **v7** docs. Written for the `live-envt` stack: Next.js 16.4.0, React 19.3.0,
TypeScript 5.9.3, Node 24.16.0, PostgreSQL 16.14.

Every claim below is tagged:

- **VERIFIED** — I ran it against the installed packages, or read the installed file, or fetched the cited doc.
- **UNVERIFIED** — reasoned from adjacent evidence; not directly executed.

> **Version-context warning.** Prisma ORM **8** is now a release candidate and `prisma.io/docs`
> defaults to v8. Prisma 7 docs live under `/docs/orm/v7/...` and `/docs/cli/v7/...`. Appending `.md`
> to any Prisma docs URL returns Markdown. Install v7 as `prisma@prev` / `@prisma/client@7`.
> Prisma 7 does **not** support MongoDB.

---

## 0. The three facts that invalidate most Prisma 5/6 knowledge

1. **The connection URL left `schema.prisma`.** `datasource db { url = ... }` is now a _hard schema error_,
   not a deprecation. The URL lives in the Prisma config file. (**VERIFIED**)
2. **`new PrismaClient()` is invalid.** A driver adapter (or `accelerateUrl`) is **required**. (**VERIFIED**)
3. **`prisma-client-js` is deprecated and no longer the default.** `prisma-client` generates plain
   TypeScript into your source tree and **requires** `output`. (**VERIFIED**)

---

## 1. `prisma.config.ts` — is it required, and what is the exact shape?

### Is it required? (**VERIFIED**)

It is **required for every command that touches the database**, and optional for pure-schema commands.

| Command                                                 | Config needed?           | Evidence                                                                                                                                                                      |
| ------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma validate`, `prisma format`                      | No                       | Ran with no config file present: `The schema at prisma/schema.prisma is valid 🚀`                                                                                             |
| `prisma generate`                                       | No datasource URL needed | Ran `generate` with a config whose `datasource` block was absent — succeeded; the generator needs only `output`. (Generating with _no config file at all_ is **UNVERIFIED**.) |
| `prisma migrate dev/deploy/status/reset`                | **Yes**                  | `Error: The datasource.url property is required in your Prisma config file when using prisma migrate status.`                                                                 |
| `prisma db push` / `db pull` / `db seed` / `db execute` | **Yes**                  | `Error: The datasource.url property is required in your Prisma config file when using prisma db push.`                                                                        |

So: datasource URL, migrations path, and seed command all live here now.

### File name: `prisma7.config.ts` vs `prisma.config.ts` (**VERIFIED**)

`prisma init` under 7.10.0 writes **`prisma7.config.ts`**. Exact `prisma init` output:

```
Initialized Prisma in your project

  prisma/
    schema.prisma
  prisma7.config.ts
  .env
  .gitignore
```

The discovery code in `@prisma/config` `dist/index.js` resolves
`prisma7.config.*` (and `.config/prisma7.*`) first, then falls back to the legacy
`prisma.config.*` / `.config/prisma` / `.config/prisma.config` basenames, across
extensions `js, ts, mjs, cjs, mts, cts`.

- Both names work. I put **both** files in one directory and ran `prisma validate`:
  `Loaded Prisma config from prisma7.config.ts.` → **`prisma7.config.ts` wins**.
- This repo's `prisma.config.ts` also loads: `Loaded Prisma config from prisma.config.ts.`
- **Recommendation:** keep `prisma.config.ts` (matches the v7 docs, and this repo already has it).
  `prisma7.config.ts` exists only so v7 and v8 configs can coexist in one repo — and a stale stray
  copy would silently take precedence.

### Exact shape of `PrismaConfig` (**VERIFIED** — read from the installed `@prisma/config` types)

From `node_modules/.pnpm/@prisma+config@7.10.0/node_modules/@prisma/config/dist/index.d.ts`:

```ts
export declare type Datasource = { url?: string; shadowDatabaseUrl?: string };

export declare type PrismaConfig = {
  experimental?: { externalTables?: boolean; extensions?: boolean };
  datasource?: { url?: string; shadowDatabaseUrl?: string };
  schema?: string; // file or folder (folder is searched recursively for *.prisma)
  migrations?: {
    path?: string; // where migrations live
    initShadowDb?: string; // SQL to prime the shadow DB
    seed?: string; // command run by `prisma db seed`
  };
  tables?: { external?: string[] };
  enums?: { external?: string[] };
  views?: { path?: string };
  typedSql?: { path?: string };
};

export declare function defineConfig(configInput: PrismaConfig): PrismaConfigInternal;
export declare function env(name: string): string;
```

**There is no `directUrl` key.** See §4 — that is a real bug class, and this repo had it.

### Complete working example (this repo's shape, corrected)

```ts
// prisma.config.ts  (project root, next to package.json)
import 'dotenv/config'; // REQUIRED: Prisma 7 does not load .env for you
import { defineConfig } from 'prisma/config';

const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || '';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // CLI + migrations use THIS. Point it at the direct (non-pooler) endpoint.
    url: directUrl,
    // shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL, // optional, only if you need it
  },
});
```

`env("X")` is the type-safe alternative to `process.env.X`. **VERIFIED** behaviour: with
`DATABASE_URL` unset it fails loudly rather than passing `undefined`:

```
Failed to load config file "/private/tmp/p7-legacy" as a TypeScript/JavaScript module.
Error: PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL.
```

That strictness is why this repo's config uses `process.env.DIRECT_URL || process.env.DATABASE_URL`
(the `||` fallback keeps local dev working when `DIRECT_URL` is unset). Both styles are fine.

`.env` is not auto-loaded (**VERIFIED**): `prisma init` writes into `.env` that
_"Environment variables declared in this file are NOT automatically loaded by Prisma. Please add
`import "dotenv/config";` to your `prisma7.config.ts` file"_. Without that import every `env()` call
throws. `dotenv` is already a devDependency here.

`prisma init` flags (**VERIFIED**): `--datasource-provider`, `--generator-provider`
(_"Default: `prisma-client`"_), `--output`, `--url`, `--with-model`, `--no-skills`.

---

## 2. The correct `generator` block for Next.js 16 + TypeScript

### Which provider? (**VERIFIED**)

`prisma-client` is the new default; `prisma-client-js` is **Deprecated**.

- `prisma init --help` says `--generator-provider ... Default: \`prisma-client\``.
- The CLI's internal enum is `Dl={PrismaClientJs:"prisma-client-js", PrismaClientTs:"prisma-client"}` and its
  prompt text calls `prisma-client-js` the _"Legacy Prisma Client JS generator"_.
- Docs (v7 Generators page): _"The `prisma-client` generator is the default generator"_ /
  _"The `prisma-client-js` generator is deprecated."_

`prisma-client-js` still **works** in 7.10.0 — I ran it with no `output` and it generated into
`node_modules/@prisma/client` (**VERIFIED**). Do not use it: it pins you to the old runtime and
`@prisma/client` barrel exports.

### Recommended block for this repo (**VERIFIED, builds**)

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"   // REQUIRED; relative to the schema file's directory
}

datasource db {
  provider = "postgresql"                // no url here — see §4
}
```

`output` is **required**. Omitting it gives (**VERIFIED**, exact output):

```

generator client {
  provider = "prisma-client"
  output   = "../src/generated"
}

Note: the output path is relative to the schema directory.
```

### Field reference (**VERIFIED** — CLI code in `build/cli.js` + docs, cross-checked by generating each variant)

| Option                   | Default          | Accepted values                                                               | Notes                                                                  |
| ------------------------ | ---------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `output`                 | — (**required**) | path                                                                          | relative to the schema file's directory                                |
| `runtime`                | `nodejs`         | `nodejs`, `deno`, `bun`, `workerd`, `cloudflare`, `vercel-edge`, `edge-light` | see caveat below                                                       |
| `moduleFormat`           | inferred         | `esm`, `cjs` (also accepts `commonjs`)                                        | controls `import.meta.url` vs `__dirname`                              |
| `generatedFileExtension` | `ts`             | `ts`, `mts`, `cts`                                                            | values outside the list only warn                                      |
| `importFileExtension`    | inferred         | ``, `ts`, `mts`, `cts`, `js`, `mjs`, `cjs`                                    | extension used in generated `import`s                                  |
| `engineType`             | `client`         | accepted but **silently ignored** by `prisma-client`                          | **VERIFIED**: `engineType = "library"` generated with no warning/error |
| `compilerBuild`          | `fast`           | `fast`, `small`                                                               | wasm query-compiler build                                              |

**`moduleFormat` and `importFileExtension` are auto-detected from your `tsconfig.json`.** The CLI does
this (**VERIFIED**, read from `build/cli.js`): if `allowImportingTsExtensions` or
`rewriteRelativeImportExtensions` is set, the extension is kept; else if `module === "commonjs"` **or
`moduleResolution === "bundler"`, the generated relative imports get **no** extension; otherwise
`ts → js`, `mts → mjs`, `cts → cjs`.

Consequence, measured in the same project with two different `tsconfig.json` files
(**VERIFIED** — I generated both and diffed the output):

| `tsconfig.json`                                                   | generated relative imports                               |
| ----------------------------------------------------------------- | -------------------------------------------------------- |
| no tsconfig                                                       | `from "./enums.ts"` (needs `allowImportingTsExtensions`) |
| `"moduleResolution": "bundler"`, `"module": "esnext"` (this repo) | `from "./enums"` (extensionless — correct for Next.js)   |

**So for Next.js 16 with this repo's `tsconfig.json`, do not set `moduleFormat` or
`importFileExtension` at all.** Both are inferred correctly. Explicitly pinning
`moduleFormat = "esm"` is harmless; `moduleFormat = "nodenext"` is an **error**
(`Invalid module format: "nodenext", expected "esm" or "cjs"` — **VERIFIED**).

`moduleFormat` behaviour when generated (**VERIFIED**):
`esm` (what this repo gets, since `module: "esnext"`) emits
`import { fileURLToPath } from 'node:url'` plus
`globalThis['__dirname'] = path.dirname(fileURLToPath(import.meta.url))`.
`cjs` omits both and relies on native `__dirname`.

### `runtime` caveat (**VERIFIED**)

Setting `runtime = "react-native"` — which the v7 Generators docs list as supported — **fails** on 7.10.0:

```
Error:
Unknown target runtime: "react-native". The available options are:
"nodejs", "deno", "bun", "workerd", "cloudflare", "vercel-edge", "edge-light"
```

For a Next.js Node-runtime app leave `runtime` unset or `"nodejs"`. `vercel-edge`/`workerd` swap the
runtime import from `@prisma/client/runtime/client` to `@prisma/client/runtime/wasm-compiler-edge`,
which you would only want for an Edge Runtime route/middleware.

### Where the client is generated, and the import path

Layout produced by `prisma-client` (**VERIFIED** — listed from a real generate):

```
src/generated/prisma/
├── browser.ts            # types for client components; NO PrismaClient
├── client.ts             # <-- your server-side entry point
├── commonInputTypes.ts
├── enums.ts
├── models.ts             # barrel of all model types
├── models/<Model>.ts
└── internal/
    ├── class.ts          # getPrismaClientClass(); never import directly
    ├── prismaNamespace.ts
    └── prismaNamespaceBrowser.ts
```

There is **no `index.ts`** — importing `"./generated/prisma"` (the directory) fails.
The correct import path is the `client` module (**VERIFIED**):

```ts
// src/lib/db.ts  (path from this repo's layout)
import { PrismaClient, Prisma } from '../generated/prisma/client';
```

Top-level exports of `client.ts` are exactly `PrismaClient`, `Prisma`, `$Enums` (**VERIFIED** by
enumerating the module namespace at runtime). Model types are also exported (`export type Post = ...`),
and `<Model>Model` aliases live in `models.ts` / `browser.ts`.

`tsx` gotcha: if you ever switch to `"module": "nodenext"`, generated imports become `./internal/class.js`
and `tsx` cannot resolve them; the fix is `importFileExtension = "ts"`. **Not needed here** — with
`moduleResolution: "bundler"` the imports are extensionless, and I **VERIFIED** `tsx` runs that generated
client successfully.

---

## 3. Query engine, query compiler, and driver adapters

### Rust query engine: gone. Query compiler: default. (**VERIFIED**)

`prisma version` against the installed packages:

```
prisma               : 7.10.0
@prisma/client       : 7.10.0
Query Compiler       : enabled
PSL                  : @prisma/prisma-schema-wasm 7.10.0-4.0edf323efd1d98336f3f0a68684b56f689b900d3
Schema Engine        : schema-engine-cli 0edf323efd1d98336f3f0a68684b56f689b900d3 (at node_modules/.pnpm/@prisma/engines@7.10.0/node_modules/@prisma/engines/schema-engine-darwin-arm64)
Default Engines Hash : 0edf323efd1d98336f3f0a68684b56f689b900d3
```

- `Query Compiler: enabled` — the client compiles queries to SQL in **WASM**, in-process.
- `@prisma/client` ships **no** Rust query-engine binary (**VERIFIED**: no `*query-engine*`,
  `*libquery*`, `.node`, `.dylib` files exist in the package). The compiler is
  `@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs`, referenced from the
  generated `internal/class.ts` under `config.compilerWasm`.
- A Rust **schema** engine binary **is still used** for migrate/introspect/diff. So "Rust-free" is true
  for querying, not for migrations.
- `previewFeatures = ["queryCompiler"]` is now a no-op and warns (**VERIFIED**):
  `Preview feature "queryCompiler" is deprecated. The functionality can be used without specifying it as a preview feature.`

### Driver adapters: required, not optional (**VERIFIED**)

The installed `@prisma/client/runtime/client.d.ts` states verbatim:

> _A driver adapter (or, alternatively, a Prisma Accelerate URL) is **required**._
> _adapter: SqlDriverAdapterFactory; accelerateUrl?: never;_

and the runtime enforces it. `new PrismaClient()` with no arguments throws
(**VERIFIED** — I ran the generated client):

```
ERROR NAME: PrismaClientInitializationError
ERROR MESSAGE: PrismaClient was instantiated without any options. A driver adapter is required to connect to your database.
  ... const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
      const prisma = new PrismaClient({ adapter })
```

### Exact dependencies (**VERIFIED** against the npm registry)

Published as `latest` on npm and matching this repo's `prisma`/`@prisma/client` 7.10.0:

| Package                | Version           | Its own dependencies                                                         |
| ---------------------- | ----------------- | ---------------------------------------------------------------------------- |
| `@prisma/adapter-pg`   | `7.10.0`          | `pg`, `@types/pg`, `postgres-array`, `@prisma/driver-adapter-utils`          |
| `@prisma/adapter-neon` | `7.10.0`          | `@neondatabase/serverless`, `postgres-array`, `@prisma/driver-adapter-utils` |
| `pg`                   | `8.23.1` (latest) | —                                                                            |

`pnpm add @prisma/adapter-pg pg && pnpm add -D @types/pg` (the official Next.js guide installs
`tsx @types/pg` as dev and `@prisma/client@7 @prisma/adapter-pg dotenv pg` as prod).

### (a) Local PostgreSQL over TCP

```ts
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });
```

Verified end-to-end against a local PostgreSQL 16.14 in this machine's cluster: create, `findMany`,
array filters, `$queryRaw`, and a P2002 unique violation all behaved correctly through this adapter.

### (b) Neon serverless with connection pooling

```ts
import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL }); // -pooler host
export const prisma = new PrismaClient({ adapter });
```

**Gotcha from the v7 upgrade guide:** pass only a _direct_ connection string to a driver adapter.
Do **not** feed `prisma://` / `prisma+postgres://` (Accelerate) URLs to `PrismaPg` — they fail.
Accelerate users use `new PrismaClient({ accelerateUrl })` with no adapter.

### Connection-pool defaults changed (**VERIFIED** — v7 Connection pool docs)

Driver adapters use the underlying driver's pool, not Prisma's. `pg` vs Prisma 6:

| Behaviour       | v6 URL param                   | v6 default  | v7 `pg` field             | v7 default           |
| --------------- | ------------------------------ | ----------- | ------------------------- | -------------------- |
| Pool size       | `connection_limit`             | `cores*2+1` | `max`                     | `10`                 |
| Acquire timeout | `pool_timeout`                 | `10s`       | `connectionTimeoutMillis` | `0` (**no timeout**) |
| Connect timeout | `connect_timeout`              | `5s`        | `connectionTimeoutMillis` | `0` (**no timeout**) |
| Idle timeout    | `max_idle_connection_lifetime` | `300s`      | `idleTimeoutMillis`       | `10s`                |

To recover v6-ish behaviour:

```ts
new PrismaPg({ connectionString, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 300_000 });
```

### SSL behaviour changed (**VERIFIED** — v7 upgrade guide)

Because the client now uses `pg` instead of the Rust engine, invalid TLS certificates are **no longer
ignored**; typical symptom is `P1010: User was denied access on the database`. Either set
`ssl: { rejectUnauthorized: false }` on `PrismaPg`, or configure CAs via `NODE_EXTRA_CA_CERTS`.

---

## 4. The `datasource` block, and pooled vs direct URLs

### Schema syntax (**VERIFIED**)

```prisma
datasource db {
  provider = "postgresql"
}
```

That is the whole block. `url`, `directUrl`, and `shadowDatabaseUrl` are **hard errors** in
`schema.prisma`, with these exact messages (I put each one in a schema and ran `prisma validate`):

```
error: The datasource property `url` is no longer supported in schema files. Move connection URLs for
Migrate to `prisma.config.ts` and pass either `adapter` for a direct database connection or
`accelerateUrl` for Accelerate to the `PrismaClient` constructor.
See https://pris.ly/d/config-datasource and https://pris.ly/d/prisma7-client-config

error: The datasource property `directUrl` is no longer supported in schema files.
Move connection URLs to `prisma.config.ts`. See https://pris.ly/d/config-datasource

error: The datasource property `shadowDatabaseUrl` is no longer supported in schema files.
Move connection URLs to `prisma.config.ts`. See https://pris.ly/d/config-datasource
```

Note the asymmetry: `url`/`directUrl`/`shadowDatabaseUrl` are gone from the **schema**, but
`url` and `shadowDatabaseUrl` still exist as keys of `datasource` **in the config file**.

### Is `directUrl` still a datasource attribute? **No.** (**VERIFIED**)

- In `schema.prisma`: hard error (above).
- In `prisma.config.ts`: **not a key at all**. `Datasource = { url?, shadowDatabaseUrl? }`.
  TypeScript rejects it:
  ```
  error TS2353: Object literal may only specify known properties, and 'directUrl' does not exist in
  type '{ url?: string | undefined; shadowDatabaseUrl?: string | undefined; }'.
  ```
- Worse, the CLI **silently ignores** an unknown `directUrl`. I ran `prisma validate` with
  `datasource: { url: "...", directUrl: "..." }` and got a clean
  `The schema at prisma/schema.prisma is valid 🚀` — no warning whatsoever.

> **This is why the earlier version of this repo's `prisma.config.ts` was wrong:** it declared
> `directUrl: env('DIRECT_URL')`, which type-errored and was ignored, so `DATABASE_URL` (the pooled URL)
> was what migrations would have used. The config has since been corrected.

### Pooled vs direct: the v7 pattern (**VERIFIED** — v7 PostgreSQL docs + upgrade guide)

There is exactly one place to express "CLI uses direct, app uses pooled":

```text
.env
  DATABASE_URL="postgres://user:pass@host-pooler...:6543/db?pgbouncer=true"   # pooled -> app
  DIRECT_URL="postgres://user:pass@host...:5432/db"                          # direct -> CLI
```

```ts
// prisma.config.ts — CLI/migrations
datasource: {
  url: env('DIRECT_URL');
}
```

```ts
// runtime — app
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL }); // pooled
```

Upgrade-guide wording: _"the connection string defined in `url` is used by Prisma CLI for migrations"_,
and _"If you were previously using `directUrl` to run migrations then you need to pass the `directUrl`
value in the `url` field of `prisma.config.ts` instead."_

`shadowDatabaseUrl` survives as a config key (`datasource.shadowDatabaseUrl`) if you need an explicit
shadow DB; it is unnecessary locally (Prisma creates and drops one automatically) — it matters for
cloud-hosted dev databases.

---

## 5. Migration workflow — exact verified commands

All of the following were run against a real throwaway PostgreSQL 16 database with a
`prisma.config.ts` + `migrations.seed` set up as in §1.

### `prisma migrate dev` (**VERIFIED**)

```bash
pnpm prisma migrate dev --name init
```

```
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
Datasource "db": PostgreSQL database "p7_scratch_verify", schema "public" at "localhost:5432"

Applying migration `20261014122941_init`

The following migration(s) have been created and applied from new schema changes:

prisma/migrations/
  └─ 20261014122941_init/
    └─ migration.sql

Your database is now in sync with your schema.
```

Note: **no `✔ Generated Prisma Client` line.** In v7, `migrate dev` and `db push` no longer run
`prisma generate` (**VERIFIED**). Run `prisma generate` yourself — this repo's `package.json` already
has separate `db:generate` and `db:migrate` scripts, which is the right shape.

`migrate dev` is still interactive; in a non-TTY it refuses rather than guessing (**VERIFIED**):
`Error: Prisma Migrate has detected that the environment is non-interactive, which is not supported.`

### `prisma migrate deploy` (**VERIFIED**)

```bash
pnpm prisma migrate deploy
```

```
Datasource "db": PostgreSQL database "p7_scratch_verify", schema "public" at "localhost:5432"
1 migration found in prisma/migrations

No pending migrations to apply.
```

### `prisma db push` (**VERIFIED**)

```bash
pnpm prisma db push                                   # sync; errors on data loss
pnpm prisma db push --accept-data-loss
pnpm prisma db push --force-reset --accept-data-loss
```

```
The PostgreSQL database "p7_scratch_verify" schema "public" at "localhost:5432" was successfully reset.

🚀  Your database is now in sync with your Prisma schema. Done in 34ms
```

### `prisma migrate reset` (**VERIFIED**)

```bash
pnpm prisma migrate reset --force
```

```
Applying migration `20261014122941_init`
Database reset successful

The following migration(s) have been applied:
migrations/  └─ 20261014122941_init/  └─ migration.sql
```

Note: **the seed was NOT run.** Prisma 7 removed automatic seeding. Docs:
_"In Prisma ORM v7, seeding is only triggered explicitly by running `npx prisma db seed`."_

### Seeding: registration and invocation (**VERIFIED**)

Registration is `migrations.seed` in `prisma.config.ts` — a full command string, not a file path:

```ts
migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
```

```bash
pnpm prisma db seed
```

```
Running seed command `tsx prisma/seed.ts` ...
seed OK, widget count = 1

🌱  The seed command has been executed.
```

**Two practical notes (**VERIFIED**):**

1. `prisma db seed` spawns the command as a child process, so the binary must be resolvable on `PATH`.
   Running the CLI with a bare `node node_modules/prisma/build/index.js db seed` and no
   `node_modules/.bin` on `PATH` fails with `Error: Command failed with ENOENT: tsx prisma/seed.ts`.
   Invoking through a package script (`pnpm db:seed`, `pnpm exec prisma db seed`) puts
   `node_modules/.bin` on `PATH` and works.
2. The seed script must build its own client **with an adapter** — the seed process does not inherit
   any client instance.

```ts
// prisma/seed.ts
import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.widget.create({ data: { name: 'seeded-widget' } });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

`prisma db seed -- --environment development` still forwards extra args after `--`.

### Removed flags (**VERIFIED**)

`--skip-generate` (on `migrate dev`, `db push`) and `--skip-seed` (on `migrate dev`) no longer exist:

```
$ pnpm prisma migrate dev --skip-generate
! unknown or unexpected option: --skip-generate
```

Also removed: `prisma db execute --schema` and `--url` (**VERIFIED** — `db --help` lists only
`--config`); `db pull/push/dev/reset` gained a `--url` override flag that reads the config as its base.
`prisma migrate diff` replaced `--from-url` / `--to-url` / `--from-schema-datasource` /
`--to-schema-datasource` with `--from-config-datasource` / `--to-config-datasource`, and dropped
`--shadow-database-url`.

### Recommended `package.json` scripts (this repo's shape, verified to work)

```json
{
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:push": "prisma db push",
    "db:reset": "prisma migrate reset --force",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio",
    "postinstall": "prisma generate"
  }
}
```

`postinstall` matters on Vercel/Netlify: their dependency caching otherwise leaves a stale client
(**VERIFIED** — v7 Vercel deploy docs).

---

## 6. Integration tests: pointing the client at another database

There is no `datasourceUrl`/`datasources` escape hatch any more (**VERIFIED**):

```
[new PrismaClient({ datasources: { db: { url } } })] THREW PrismaClientConstructorValidationError:
  Unknown property datasources provided to PrismaClient constructor.
[new PrismaClient({ datasourceUrl })] THREW PrismaClientConstructorValidationError:
  Unknown property datasourceUrl provided to PrismaClient constructor.
```

The URL is a property of the **adapter**, so a test-only client is just a differently-configured
adapter. **VERIFIED** — this exact script ran green against a real database:

```ts
// tests/integration/db.ts
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';

/** Build a client from an EXPLICIT connection string (never the ambient one). */
export function createTestClient(connectionString = process.env.TEST_DATABASE_URL) {
  if (!connectionString) throw new Error('TEST_DATABASE_URL is required for integration tests');
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = createTestClient();
export const testDbUrl = process.env.TEST_DATABASE_URL!;
```

Environment handling that matches this repo's `.env.example`:

- `DATABASE_URL` — pooled/production-app URL.
- `DIRECT_URL` — direct URL for the CLI.
- `TEST_DATABASE_URL` — a **separate database** (`liveenvt_test`), used only by
  `pnpm test:integration`. `src/lib/env.ts` already validates it as optional.
- Because `prisma.config.ts` reads `DIRECT_URL || DATABASE_URL`, you must override the env for
  test-time migrations, e.g.:

```bash
DIRECT_URL="$TEST_DATABASE_URL" pnpm prisma migrate deploy
```

Cleanup between suites (**VERIFIED** as a pattern): `TRUNCATE ... RESTART IDENTITY CASCADE` via
`$executeRawUnsafe` is more robust than ordered `deleteMany` calls, which one of the v7 testing docs
pages itself cautions about.

**Pitfall:** the v7 "Next.js troubleshooting" page still shows the Prisma 6 snippet
`new PrismaClient({ datasources: { db: { url } } })` under _"Dynamic usage of Prisma Client"_. That code
**throws** on 7.10.0. For tenant/dynamic-database clients, build a `PrismaPg` (or `PrismaNeon`) per
tenant and pass it as `adapter`.

---

## 7. Client constructor / import changes and the Next.js singleton

### What changed (**VERIFIED**)

| Prisma 6                                                         | Prisma 7                                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `import { PrismaClient } from '@prisma/client'`                  | `import { PrismaClient } from '<output>/client'`                   |
| `new PrismaClient()`                                             | `new PrismaClient({ adapter })` — adapter **required**             |
| `new PrismaClient({ datasources: { db: { url } } })`             | **throws** `PrismaClientConstructorValidationError`                |
| `new PrismaClient({ datasourceUrl })`                            | **throws** `PrismaClientConstructorValidationError`                |
| `prisma.$use(...)` middleware                                    | **removed** — `TypeError: prisma.$use is not a function`           |
| `Prisma.validator<T>()`                                          | **removed** — `Prisma.validator === undefined`; use TS `satisfies` |
| `import { PrismaClientKnownRequestError } from '@prisma/client'` | `Prisma.PrismaClientKnownRequestError`                             |

### Recommended singleton for Next.js dev hot-reload

```ts
// src/lib/db.ts
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Create the adapter once; it owns the pg connection pool.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  // Optional: restore Prisma 6-ish timeouts (pg defaults to no connect timeout).
  // connectionTimeoutMillis: 5_000,
  // idleTimeoutMillis: 300_000,
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

Caveats worth knowing:

- The adapter is created before the global check. That is deliberate (the adapter is cheap; the pool
  connects lazily on first query). If you want to avoid constructing it on reloads, guard the whole
  block rather than just the client.
- Creating a new `PrismaClient` per request without reuse exhausts the pool. The global pattern above
  is the one the official v7 Next.js guide uses.
- On Vercel Fluid compute, wrap the pool so suspended functions release connections
  (**UNVERIFIED** locally, documented pattern):

```ts
import { Pool } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
attachDatabasePool(pool);
export const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
```

---

## 8. Prisma 6 → 7 breaking changes that affect this stack

**Schema**

- `datasource.url`, `datasource.directUrl`, `datasource.shadowDatabaseUrl` in `schema.prisma`: **hard
  errors**. Move to `prisma.config.ts`. (**VERIFIED**)
- No MongoDB support in v7.

**Generator config**

- `prisma-client` is the default and `prisma-client-js` is deprecated.
- `output` is **required**; nothing is generated into `node_modules` any more.
- `moduleFormat` accepts only `esm`/`cjs`; both `moduleFormat` and `importFileExtension` are inferred
  from `tsconfig.json`.
- `engineType` is accepted but ignored; `binaryTargets`/`previewFeatures` on `prisma-client` are
  vestigial (they were `prisma-client-js` concepts).

**Client instantiation**

- Driver adapter (or `accelerateUrl`) **required**. `new PrismaClient()` throws.
- `datasources` / `datasourceUrl` constructor options **removed** and now throw.
- Client middleware `$use` **removed** — use `$extends`.
- Metrics preview feature **removed**; the upgrade guide shows a `$extends`-based query counter.
- Client ships as ESM and no longer loads `.env` itself. Recommended `package.json` has
  `"type": "module"` and `tsconfig` uses `module: ESNext`, `moduleResolution: bundler`
  (`esModuleInterop: true`). **Note for this repo:** `package.json` does not currently set
  `"type": "module"`; because `moduleResolution` is `"bundler"` and Next.js compiles the app, this has
  not been a problem, but it is the documented target state.

**Migrations / CLI** (details and exact output in §5)

- `migrate dev` / `db push` no longer run `prisma generate`; `--skip-generate` and `--skip-seed` removed.
- `db execute --schema` / `--url` removed; `migrate diff` URL flags became
  `--from-config-datasource` / `--to-config-datasource`.

**Seeding**

- No automatic seeding on `migrate dev` / `migrate reset`; only `prisma db seed`.
- Seed command is registered as `migrations.seed` in `prisma.config.ts` (was `package.json > prisma.seed`).

**JSON / arrays / raw SQL** — **API surface unchanged in v7** (**VERIFIED** at runtime):

- `Prisma.JsonNull`, `Prisma.DbNull`, `Prisma.AnyNull` all still exist and are still needed to
  distinguish SQL `NULL` from JSON `null`.
- JSON `path` / `string_contains` / `array_contains` filters work as before.
- Scalar lists: `has`, `hasEvery`, `hasSome`, `isEmpty`, `push` work as before.
  (Documented pre-existing caveat: `NULL` arrays are not matched by `NOT` or `isEmpty`; default such
  fields to `[]`.)
- `$queryRaw`, `$queryRawUnsafe`, `$executeRaw`, `$executeRawUnsafe`, `Prisma.sql`, `Prisma.join`,
  `Prisma.raw`, `Prisma.empty` all work. What changed is only the **import path**:
  `import { Prisma } from '<output>/client'` (the v7 raw-SQL docs examples that show
  `from "@prisma/client"` are stale).
- `Prisma.validator` is **gone** (**VERIFIED**: `undefined`). The v7 JSON-fields doc still uses it in
  its "advanced example" — that example is stale; use `satisfies` / plain typed literals.

**Error classes** (**VERIFIED** by enumerating the runtime `.d.ts` and the generated namespace)

- Still present: `PrismaClientKnownRequestError`, `PrismaClientUnknownRequestError`,
  `PrismaClientRustPanicError` (kept despite no Rust query engine),
  `PrismaClientInitializationError`, `PrismaClientValidationError`.
- They are **not** exported from the top level of the generated `client.ts`; only `PrismaClient`,
  `Prisma`, `$Enums` are. Use `Prisma.PrismaClientKnownRequestError`.
- Runtime confirmation:
  ```
  P2002 instanceof Prisma.PrismaClientKnownRequestError = true | code = P2002
  PrismaClientValidationError available = function
  ```
- One new error type surfaces at construction: `PrismaClientConstructorValidationError`
  (subclass of `PrismaClientValidationError`) for unknown constructor properties.

**Environment variables removed** (upgrade guide): `PRISMA_CLI_QUERY_ENGINE_TYPE`,
`PRISMA_CLIENT_ENGINE_TYPE`, `PRISMA_QUERY_ENGINE_BINARY`, `PRISMA_QUERY_ENGINE_LIBRARY`,
`PRISMA_GENERATE_SKIP_AUTOINSTALL`, `PRISMA_SKIP_POSTINSTALL_GENERATE`, `PRISMA_GENERATE_IN_POSTINSTALL`,
`PRISMA_GENERATE_DATAPROXY`, `PRISMA_GENERATE_NO_ENGINE`, `PRISMA_CLIENT_NO_RETRY`,
`PRISMA_MIGRATE_SKIP_GENERATE`, `PRISMA_MIGRATE_SKIP_SEED`. Also note `XDG_CACHE_HOME` is honoured for
the engine cache — useful in sandboxed CI.

### Gotchas list

1. `datasource.url` in `schema.prisma` → hard error. Move it to `prisma.config.ts`.
2. `directUrl` in `prisma.config.ts` → **type error and silently ignored**. Use `url` = direct URL.
3. `new PrismaClient()` → throws. Always pass `{ adapter }`.
4. `@prisma/client` bare import → only works if you used the deprecated `prisma-client-js`. Import from
   your `output` path instead.
5. No `index.ts` in the generated output — import `<output>/client`, not `<output>`.
6. `.env` is not auto-loaded. Add `import 'dotenv/config'` to the config file _and_ to seed/test entry
   points. Missing it yields confusing driver errors such as
   `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`.
7. `migrate dev` no longer generates the client. Chained `db:migrate` scripts that relied on that will
   silently use a stale client.
8. `migrate dev`/`migrate reset` no longer seed. A test suite that assumed seeding must call `prisma db seed`.
9. `prisma db seed` spawns the seed command on `PATH`; run it through a package script.
10. `pg` has **no connect timeout** by default. A wrong host now hangs instead of failing in 5s.
11. TLS verification is now strict; `P1010` after upgrade usually means an untrusted certificate.
12. `Prisma.validator` is gone; `prisma.$use` is gone.
13. `prisma7.config.ts` wins over `prisma.config.ts` if both exist — do not leave a stale stray file.
14. Generated `.d.ts`/`.ts` output is marked `// @ts-nocheck`, so client type errors surface at the
    call site, not inside the generated files. Don't exclude the folder from `tsconfig.json` if you
    want model types available.
15. Add the generated directory to `.gitignore` (the repo already ignores `/generated/prisma`; the
    actual output is `src/generated/prisma`, so the ignore pattern should be checked).

---

## 9. Next.js Route Handlers and Server Components

### Does it bundle cleanly? **Yes — verified with a real production build.**

I built an isolated Next.js 16.4.0 app (same `tsconfig.json` and `next.config.ts` settings as this
repo: `cacheComponents: true`, `partialPrefetching: true`) containing a Server Component page and a
Route Handler, both calling Prisma 7 through `@prisma/adapter-pg`:

```
✓ Compiled successfully in 1645ms
  Finished TypeScript in 1273ms ...
✓ Generating static pages using 5 workers (4/4) in 450ms

Route (app)
┌ ◐ /
├ ○ /_not-found
└ ƒ /api/ping
```

The Server Component page rendered as partial-prerender and the Route Handler as dynamic. **No
bundling errors, no WASM resolution errors, no `serverExternalPackages` configuration.**

### Is `serverExternalPackages` needed? **No.** (**VERIFIED**)

- The v7 Next.js guide and troubleshooting page never mention `next.config` — there is no required change.
- The only reason the old advice existed was the Rust query-engine **file** that had to be resolved at
  runtime. In v7 the query compiler ships as an inlined base64 WASM module
  (`@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs`), so there is no external
  file path to preserve. Bundling is safe.
- Independently, Next.js 16.4.0 already externalizes the relevant packages by default. Its shipped
  list (`node_modules/next/dist/lib/server-external-packages.jsonc`) contains `@prisma/client`,
  `prisma`, `pg`, `@libsql/client`, `@mikro-orm/*`, and `better-sqlite3`-class drivers. So even the
  `@prisma/client/runtime/*` imports resolve as native requires.
- The generated client itself lives in your source tree (`src/generated/prisma`), is plain TypeScript,
  and is bundled exactly like the rest of your app. `serverExternalPackages` cannot and need not
  externalize it.

If you later adopt the Edge Runtime (`runtime = "vercel-edge"` + `@prisma/adapter-neon` in a
`middleware.ts` or `export const runtime = 'edge'` route), re-verify then — that path swaps to the
`wasm-compiler-edge` runtime. **UNVERIFIED** for this repo.

### Next.js 16 `cacheComponents` interaction (not a Prisma problem, but it will bite)

With `cacheComponents: true`, a database call in a page during prerender is an error:

```
Error: Route "/" Next.js encountered uncached or runtime data during prerendering.
`fetch(...)`, `cookies()`, `headers()`, `params`, `searchParams`, or `connection()` accessed outside
of `<Suspense>` prevents the route from being prerendered ...
```

That is Next.js behaviour, independent of Prisma. Fixes: wrap the data access in `<Suspense>`
(verified — the build went green), add `"use cache"`, or set `export const instant = false`.

### Does the client leak into client components? **No, if you import the right module.**

- `client.ts` has transitive Node-only dependencies (`node:process`, `node:path`, `node:url`,
  `@prisma/client/runtime/client`) and must never be imported from a Client Component or a `"use
client"` file.
- For types/values in the browser, import from `<output>/browser` (no `PrismaClient`) or
  `<output>/enums`. (**VERIFIED** from the generated file headers.)
- `src/lib/db.ts` should stay server-only. This repo already uses `import 'server-only'` in
  `src/lib/env.ts`; adding it to the Prisma module is advisable so an accidental client import fails at
  build time rather than shipping `pg` to the browser.

---

## 10. Action items for this repo

1. ~~Fix `datasource.directUrl`~~ — **done**; `prisma.config.ts` now passes the direct URL as `url`.
2. **Add the driver adapter** (§3). `package.json` has `@prisma/client` and `prisma` but no adapter, and
   none is in `pnpm-lock.yaml`. Until it is installed no runtime query can work:
   `pnpm add @prisma/adapter-pg pg && pnpm add -D @types/pg`
   (or `@prisma/adapter-neon` for Neon serverless). Pin to `7.10.0`.
3. **Add a singleton client module** (`src/lib/db.ts`, §7) and use it from Route Handlers and Server
   Components. Consider adding `import 'server-only'` to it, as `src/lib/env.ts` already does.
4. **Check the `.gitignore` pattern** — the schema outputs to `src/generated/prisma`, but the ignore
   currently says `/generated/prisma`.

---

## Sources

All Prisma v7 pages (append `.md` for Markdown); the upgrade guide and config reference are the two
most load-bearing:

- Upgrade to Prisma ORM 7 — <https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7.md>
- Config API — <https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference>
- Generators — <https://www.prisma.io/docs/orm/v7/prisma-schema/overview/generators.md>
- Data sources — <https://www.prisma.io/docs/orm/v7/prisma-schema/overview/data-sources.md>
- Database drivers — <https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/database-drivers.md>
- PostgreSQL (pooled vs direct, Neon) — <https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql.md>
- Connection pool — <https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/connection-pool.md>
- Seeding — <https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/seeding.md>
- Integration testing — <https://www.prisma.io/docs/orm/v7/prisma-client/testing/integration-testing.md>
- Raw queries — <https://www.prisma.io/docs/orm/v7/prisma-client/using-raw-sql/raw-queries.md>
- Json fields — <https://www.prisma.io/docs/orm/v7/prisma-client/special-fields-and-types/working-with-json-fields.md>
- Scalar lists / arrays — <https://www.prisma.io/docs/orm/v7/prisma-client/special-fields-and-types/working-with-scalar-lists-arrays.md>
- Errors — <https://www.prisma.io/docs/orm/v7/prisma-client/debugging-and-troubleshooting/handling-exceptions-and-errors.md>
- Next.js guide — <https://www.prisma.io/docs/guides/v7/frameworks/nextjs.md>
- Next.js troubleshooting — <https://www.prisma.io/docs/orm/v7/more/troubleshooting/nextjs.md>
- Deploy to Vercel (Fluid) — <https://www.prisma.io/docs/orm/v7/prisma-client/deployment/serverless/deploy-to-vercel.md>
- v7 docs index — <https://www.prisma.io/docs/llms/orm-v7.txt>
- Next.js `serverExternalPackages` — <https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages>
- npm registry: `@prisma/adapter-pg`, `@prisma/adapter-neon` (both `latest = 7.10.0`)
