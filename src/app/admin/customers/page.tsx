import { Suspense } from 'react';
import { connection } from 'next/server';
import { Text } from '@mantine/core';
import { IconUsers } from '@tabler/icons-react';
import { DataTable, EmptyState, PageHeader, StatusBadge, TableSkeleton } from '@/components/ui';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { getCurrentActor } from '@/lib/auth/actor';
import { adminListCustomers } from '@/server/services/admin-enquiry.service';
import { adminCustomerQuerySchema, type AdminCustomerQuery } from '@/lib/validation/enquiry';
import { describeError } from '../_lib/errors';
import { parsePageQuery, toUrlParams, type PageSearchParams } from '../_lib/query';
import { RetryState } from '@/components/admin/RetryState';
import { CustomersFilters } from '@/components/admin/CustomersFilters';
import { CUSTOMER_FILTER_KEYS } from '@/components/admin/filter-keys';
import { TablePagination } from '@/components/admin/TablePagination';
import { CustomerModerationControl } from '@/components/admin/CustomerModerationControl';
import {
  CustomerCreatedCell,
  CustomerNameCell,
  CustomerRoleBadge,
  CustomerStatusBadge,
  type AdminCustomerRow,
} from '@/components/admin/CustomerCells';
import type { UrlParams } from '@/components/admin/use-url-filters';
import { AdminTableRegion } from '@/components/admin/AdminTable';
import pageClasses from '@/components/admin/AdminPage.module.css';

export const metadata = { title: 'Customers' };

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const raw = await searchParams;
  const query = parsePageQuery(adminCustomerQuerySchema, raw);
  const urlParams = toUrlParams(raw);

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Accounts that can send enquiries and track them. Moderation is limited to customer accounts; administrators are managed elsewhere."
      />

      <Suspense fallback={<TableSkeleton rows={1} columns={6} />}>
        <CustomersResult query={query} urlParams={urlParams} />
      </Suspense>
    </div>
  );
}

async function CustomersResult({
  query,
  urlParams,
}: {
  query: AdminCustomerQuery;
  urlParams: UrlParams;
}) {
  // Request-time by definition: the filters come from the URL and the panel is
  // authenticated.
  await connection();

  let result: Awaited<ReturnType<typeof adminListCustomers>>;
  let actorUserId: string | null = null;
  try {
    // Read inside the boundary: the actor id is what lets the table disable
    // moderation on the signed-in administrator's own row, so it is resolved
    // here rather than at the top of the page, keeping every request-time read
    // inside one Suspense boundary.
    const [loaded, actor] = await Promise.all([adminListCustomers(query), getCurrentActor()]);
    result = loaded;
    actorUserId = actor.kind === 'admin' ? actor.user.id : null;
  } catch (error) {
    return <RetryState title="Could not load customers" detail={describeError(error)} />;
  }

  const activeCount = CUSTOMER_FILTER_KEYS.filter(
    (key) => urlParams[key] !== undefined && urlParams[key] !== '',
  ).length;

  const columns: ReadonlyArray<DataTableColumn<AdminCustomerRow>> = [
    {
      key: 'account',
      header: 'Account',
      width: 240,
      render: (row) => <CustomerNameCell row={row} />,
    },
    {
      key: 'role',
      header: 'Role',
      width: 140,
      render: (row) => <CustomerRoleBadge role={row.role} />,
    },
    {
      key: 'status',
      header: 'Status',
      width: 130,
      render: (row) => <CustomerStatusBadge status={row.status} />,
    },
    {
      key: 'verified',
      header: 'Email',
      width: 130,
      render: (row) =>
        row.emailVerified ? (
          <StatusBadge tone="success" size="sm">
            Verified
          </StatusBadge>
        ) : (
          <StatusBadge tone="neutral" size="sm">
            Unverified
          </StatusBadge>
        ),
    },
    {
      key: 'enquiries',
      header: 'Enquiries',
      width: 100,
      align: 'end',
      render: (row) => (
        <Text size="sm" className={pageClasses.tabularValue}>
          {row._count.enquiries}
        </Text>
      ),
    },
    {
      key: 'joined',
      header: 'Joined',
      width: 160,
      render: (row) => <CustomerCreatedCell row={row} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 70,
      align: 'end',
      render: (row) => (
        <CustomerModerationControl
          userId={row.id}
          name={row.name}
          status={row.status}
          role={row.role}
          isSelf={actorUserId !== null && row.id === actorUserId}
        />
      ),
    },
  ];

  return (
    <>
      <div className={pageClasses.toolbar}>
        <CustomersFilters current={urlParams} resultCount={result.pagination.totalItems} />
      </div>

      <AdminTableRegion>
        <DataTable
          caption="Customer accounts"
          columns={columns}
          rows={result.data}
          getRowKey={(row) => row.id}
          minWidth={980}
          emptyState={
            activeCount > 0 ? (
              <EmptyState
                title="No accounts match these filters"
                description="Loosen or clear the filters to see more accounts."
              />
            ) : (
              <EmptyState
                icon={<IconUsers size={20} stroke={1.5} />}
                title="No accounts yet"
                description="Customer accounts appear here as soon as people sign up."
              />
            )
          }
        />

        <TablePagination
          page={result.pagination.page}
          pageSize={result.pagination.pageSize}
          totalItems={result.pagination.totalItems}
          params={urlParams}
          itemLabel="accounts"
        />
      </AdminTableRegion>
    </>
  );
}
