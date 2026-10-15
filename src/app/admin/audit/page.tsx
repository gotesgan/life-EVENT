import { Suspense } from 'react';
import { connection } from 'next/server';
import { EmptyState, PageHeader, TableSkeleton } from '@/components/ui';
import { listAuditLogs } from '@/server/services/audit.service';
import { adminAuditQuerySchema } from '@/lib/validation/enquiry';
import { AUDIT_ACTIONS } from '@/lib/validation/audit';
import { describeError } from '../_lib/errors';
import { parsePageQuery, toUrlParams, type PageSearchParams } from '../_lib/query';
import { RetryState } from '@/components/admin/RetryState';
import { AuditFilters } from '@/components/admin/AuditFilters';
import { AuditTable } from '@/components/admin/AuditTable';
import type { z } from 'zod';
import { AUDIT_FILTER_KEYS } from '@/components/admin/filter-keys';
import { TablePagination } from '@/components/admin/TablePagination';
import { AUDIT_ENTITY_TYPES, auditActorSelectOptions } from './_lib/options';
import type { UrlParams } from '@/components/admin/use-url-filters';
import { AdminTableRegion } from '@/components/admin/AdminTable';
import pageClasses from '@/components/admin/AdminPage.module.css';

export const metadata = { title: 'Audit log' };

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const raw = await searchParams;
  const query = parsePageQuery(adminAuditQuerySchema, raw);
  const urlParams = toUrlParams(raw);

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Every administrative action, who performed it and when. Entries are append-only and are never edited."
      />

      <Suspense fallback={<TableSkeleton rows={1} columns={6} />}>
        <AuditResult query={query} urlParams={urlParams} />
      </Suspense>
    </div>
  );
}

async function AuditResult({
  query,
  urlParams,
}: {
  query: z.infer<typeof adminAuditQuerySchema>;
  urlParams: UrlParams;
}) {
  // Request-time by definition: the log is per-request data behind an
  // authenticated, filterable list.
  await connection();

  let result: Awaited<ReturnType<typeof listAuditLogs>>;
  let actorOptions: Awaited<ReturnType<typeof auditActorSelectOptions>>;
  try {
    [result, actorOptions] = await Promise.all([listAuditLogs(query), auditActorSelectOptions()]);
  } catch (error) {
    return <RetryState title="Could not load the audit log" detail={describeError(error)} />;
  }

  const activeCount = AUDIT_FILTER_KEYS.filter(
    (key) => urlParams[key] !== undefined && urlParams[key] !== '',
  ).length;

  return (
    <>
      <div className={pageClasses.toolbar}>
        <AuditFilters
          current={urlParams}
          actionOptions={AUDIT_ACTIONS}
          entityTypeOptions={AUDIT_ENTITY_TYPES}
          actorOptions={actorOptions}
          resultCount={result.totalItems}
        />
      </div>

      <AdminTableRegion>
        <AuditTable
          rows={result.rows}
          emptyState={
            activeCount > 0 ? (
              <EmptyState
                title="No entries match these filters"
                description="Loosen or clear the filters to see more of the log."
              />
            ) : (
              <EmptyState
                title="Nothing recorded yet"
                description="Administrative actions — publishing a listing, moving a lead, moderating an account — appear here as they happen."
              />
            )
          }
        />

        {result.totalItems > 0 ? (
          <TablePagination
            page={query.page}
            pageSize={query.pageSize}
            totalItems={result.totalItems}
            params={urlParams}
            itemLabel="entries"
          />
        ) : null}
      </AdminTableRegion>
    </>
  );
}
