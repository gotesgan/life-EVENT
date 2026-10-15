/**
 * Seeded accounts.
 *
 * Passwords are hashed by Better Auth's own hasher (`better-auth/crypto`,
 * scrypt with a per-hash salt — the default `emailAndPassword.password.hash`
 * implementation) and stored on the `Account` row in the shape Better Auth's
 * adapter writes: `providerId: 'credential'`, `accountId` = the user id.
 *
 * See `src/lib/db.ts` for the Prisma wiring and `dist/api/routes/sign-up.mjs`
 * in the installed `better-auth` package for the account row this mirrors.
 */

export interface UserSeed {
  key: 'admin' | 'priya' | 'arjun';
  name: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'CUSTOMER';
  emailVerified: boolean;
  profile: {
    phone: string;
    citySlug: string;
    preferredContactMethod: 'EMAIL' | 'PHONE' | 'WHATSAPP';
    marketingConsent: boolean;
  } | null;
}

export const USER_SEEDS: readonly UserSeed[] = [
  {
    key: 'admin',
    name: 'Platform Admin',
    email: 'admin@liveenvt.test',
    password: 'AdminPass123!',
    role: 'ADMIN',
    emailVerified: true,
    profile: null,
  },
  {
    key: 'priya',
    name: 'Priya Nair',
    email: 'priya@example.test',
    password: 'CustomerPass123!',
    role: 'CUSTOMER',
    emailVerified: true,
    profile: {
      phone: '+91 90000 00103',
      citySlug: 'bandra-west',
      preferredContactMethod: 'PHONE',
      marketingConsent: true,
    },
  },
  {
    key: 'arjun',
    name: 'Arjun Mehta',
    email: 'arjun@example.test',
    password: 'CustomerPass123!',
    role: 'CUSTOMER',
    emailVerified: true,
    profile: {
      phone: '+91 90000 00101',
      citySlug: 'juhu',
      preferredContactMethod: 'WHATSAPP',
      marketingConsent: false,
    },
  },
];
