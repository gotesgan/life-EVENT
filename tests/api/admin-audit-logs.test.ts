import { beforeEach, describe, expect, it } from 'vitest';
import { GET as listAuditLogs } from '@/app/api/admin/audit-logs/route';
import {
  clearRuntimeState,
  makeRequest,
  readJson,
  routeContext,
  signInAsAdmin,
  signInAsCustomer,
  withCookie,
  type ApiErrorResponse,
  type PaginatedResponse,
} from './api-helpers';
import { uniqueSuffix } from '../integration/helpers';

/**
 * `GET /api/admin/audit-logs` — the administrative audit ledger.
 *
 * The rules under test are the ones that make the ledger trustworthy as a
 * paging UI: filter by action and entity, newest-first with a stable `id`
 * tie-break, and offset pagination that neither repeats nor skips a row.
 */

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
}

function errorOf(body: unknown): ApiErrorResponse['error'] {
  return (body as ApiErrorResponse).error;
}

async function insertAuditRows(
  rows: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: Date;
  }>,
): Promise<void> {
  const { prisma } = await import('@/lib/db');
  await prisma.auditLog.createMany({
    data: rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      summary: `${row.action} ${row.entityId}`,
      createdAt: row.createdAt,
    })),
  });
}

async function fetchAudit(query: string, cookie: string) {
  const response = await listAuditLogs(
    makeRequest(`/api/admin/audit-logs${query}`, { headers: withCookie(cookie) }),
    routeContext({}),
  );
  return {
    status: response.status,
    body: await readJson<PaginatedResponse<AuditRow> & ApiErrorResponse>(response),
  };
}

beforeEach(async () => {
  await clearRuntimeState();
});

describe('GET /api/admin/audit-logs authorization', () => {
  it('returns 401 without a session', async () => {
    const response = await listAuditLogs(makeRequest('/api/admin/audit-logs'), routeContext({}));
    expect(response.status).toBe(401);
    expect(errorOf(await readJson(response)).code).toBe('UNAUTHENTICATED');
  });

  it('returns 403 for a signed-in customer', async () => {
    const customer = await signInAsCustomer('priya');
    const { status, body } = await fetchAudit('', customer.cookie);
    expect(status).toBe(403);
    expect(errorOf(body).code).toBe('FORBIDDEN');
  });
});

describe('GET /api/admin/audit-logs filtering', () => {
  it('filters by action and entityType together', async () => {
    const admin = await signInAsAdmin();
    const entityType = `AuditFixture${uniqueSuffix()}`;
    const entityId = `entity-${uniqueSuffix()}`;

    await insertAuditRows([
      {
        id: `audit-${uniqueSuffix()}-a`,
        action: 'listing.created',
        entityType,
        entityId,
        createdAt: new Date('2026-01-01T00:00:01.000Z'),
      },
      {
        id: `audit-${uniqueSuffix()}-b`,
        action: 'listing.created',
        entityType,
        entityId,
        createdAt: new Date('2026-01-01T00:00:02.000Z'),
      },
      {
        id: `audit-${uniqueSuffix()}-c`,
        action: 'listing.updated',
        entityType,
        entityId,
        createdAt: new Date('2026-01-01T00:00:03.000Z'),
      },
    ]);

    const { status, body } = await fetchAudit(
      `?entityType=${encodeURIComponent(entityType)}&action=listing.created`,
      admin.cookie,
    );

    expect(status).toBe(200);
    expect(body.pagination.totalItems).toBe(2);
    expect(body.data).toHaveLength(2);
    for (const row of body.data) {
      expect(row.action).toBe('listing.created');
      expect(row.entityType).toBe(entityType);
    }
  });

  it('filters by entityId', async () => {
    const admin = await signInAsAdmin();
    const entityType = `AuditFixture${uniqueSuffix()}`;
    const wantedId = `entity-${uniqueSuffix()}`;
    const otherId = `entity-${uniqueSuffix()}`;

    await insertAuditRows([
      {
        id: `audit-${uniqueSuffix()}-a`,
        action: 'listing.created',
        entityType,
        entityId: wantedId,
        createdAt: new Date('2026-01-01T00:00:01.000Z'),
      },
      {
        id: `audit-${uniqueSuffix()}-b`,
        action: 'listing.created',
        entityType,
        entityId: otherId,
        createdAt: new Date('2026-01-01T00:00:02.000Z'),
      },
    ]);

    const { status, body } = await fetchAudit(
      `?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(wantedId)}`,
      admin.cookie,
    );

    expect(status).toBe(200);
    expect(body.pagination.totalItems).toBe(1);
    expect(body.data[0]?.entityId).toBe(wantedId);
  });

  it('returns an empty page for an action nobody performed', async () => {
    const admin = await signInAsAdmin();
    const { status, body } = await fetchAudit(
      `?action=listing.verified&entityType=NoSuchEntity${uniqueSuffix()}`,
      admin.cookie,
    );
    expect(status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.pagination.totalItems).toBe(0);
  });
});

describe('GET /api/admin/audit-logs ordering', () => {
  it('orders newest first', async () => {
    const admin = await signInAsAdmin();
    const entityType = `AuditFixture${uniqueSuffix()}`;

    const oldest = `audit-old-${uniqueSuffix()}`;
    const middle = `audit-mid-${uniqueSuffix()}`;
    const newest = `audit-new-${uniqueSuffix()}`;

    await insertAuditRows([
      {
        id: oldest,
        action: 'listing.created',
        entityType,
        entityId: 'same',
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
      },
      {
        id: newest,
        action: 'listing.created',
        entityType,
        entityId: 'same',
        createdAt: new Date('2026-02-03T00:00:00.000Z'),
      },
      {
        id: middle,
        action: 'listing.created',
        entityType,
        entityId: 'same',
        createdAt: new Date('2026-02-02T00:00:00.000Z'),
      },
    ]);

    const { body } = await fetchAudit(
      `?entityType=${encodeURIComponent(entityType)}&pageSize=25`,
      admin.cookie,
    );
    expect(body.data.map((row) => row.id)).toEqual([newest, middle, oldest]);
  });

  it('breaks a createdAt tie by ascending id so the order is total', async () => {
    const admin = await signInAsAdmin();
    const entityType = `AuditFixture${uniqueSuffix()}`;
    const tiedAt = new Date('2026-03-01T00:00:00.000Z');

    const first = `audit-a-${uniqueSuffix()}`;
    const second = `audit-b-${uniqueSuffix()}`;
    const third = `audit-c-${uniqueSuffix()}`;

    await insertAuditRows([
      { id: second, action: 'listing.created', entityType, entityId: 'tie', createdAt: tiedAt },
      { id: third, action: 'listing.created', entityType, entityId: 'tie', createdAt: tiedAt },
      { id: first, action: 'listing.created', entityType, entityId: 'tie', createdAt: tiedAt },
    ]);

    const { body } = await fetchAudit(
      `?entityType=${encodeURIComponent(entityType)}&pageSize=25`,
      admin.cookie,
    );
    expect(body.data.map((row) => row.id)).toEqual([first, second, third]);
  });
});

describe('GET /api/admin/audit-logs pagination', () => {
  it('pages through every row without repeating or skipping one', async () => {
    const admin = await signInAsAdmin();
    const entityType = `AuditFixture${uniqueSuffix()}`;
    const total = 5;

    await insertAuditRows(
      Array.from({ length: total }, (_, index) => ({
        id: `audit-page-${uniqueSuffix()}-${index}`,
        action: 'listing.created',
        entityType,
        entityId: `entity-${index}`,
        createdAt: new Date(Date.UTC(2026, 3, 1, 0, 0, index)),
      })),
    );

    const seen: string[] = [];
    for (let page = 1; page <= 3; page += 1) {
      const { status, body } = await fetchAudit(
        `?entityType=${encodeURIComponent(entityType)}&pageSize=2&page=${page}`,
        admin.cookie,
      );
      expect(status).toBe(200);
      expect(body.pagination.totalItems).toBe(total);
      expect(body.pagination.page).toBe(page);
      seen.push(...body.data.map((row) => row.id));
    }

    expect(seen).toHaveLength(total);
    expect(new Set(seen).size).toBe(total);
  });
});
