import Link from "next/link";

import { CustomerTable } from "@/components/admin/CustomerTable";
import { ExportButton } from "@/components/admin/ExportButton";
import { ADMIN_ROLES, CUSTOMER_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { listAdminCustomers } from "@/lib/customers/admin";
import { adminCustomerListQuerySchema } from "@/lib/customers/schemas";

interface AdminCustomersPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

function singleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseBlacklisted(value: string | undefined): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export default async function AdminCustomersPage({ searchParams }: AdminCustomersPageProps) {
  const session = await requireRole(ADMIN_ROLES);
  const parsedQuery = adminCustomerListQuerySchema.parse({
    q: singleValue(searchParams?.q),
    blacklisted: parseBlacklisted(singleValue(searchParams?.blacklisted)),
    from: singleValue(searchParams?.from),
    to: singleValue(searchParams?.to),
    limit: singleValue(searchParams?.limit),
    offset: singleValue(searchParams?.offset),
  });
  const result = await listAdminCustomers(parsedQuery);
  const previousOffset = Math.max(parsedQuery.offset - parsedQuery.limit, 0);
  const nextOffset = parsedQuery.offset + parsedQuery.limit;
  const hasNextPage = nextOffset < result.total;
  const canCreate = CUSTOMER_MANAGER_ROLES.includes(session.user.role);
  const baseQuery = Object.fromEntries(
    Object.entries({
      q: parsedQuery.q,
      blacklisted: parsedQuery.blacklisted === undefined ? undefined : String(parsedQuery.blacklisted),
      from: parsedQuery.from,
      to: parsedQuery.to,
      limit: String(parsedQuery.limit),
    }).filter((entry) => entry[1]),
  );

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-base font-semibold text-[var(--apg-text-primary)]">Customers</h1>
          <p className="mt-1 text-sm text-[var(--apg-text-secondary)]">Tra cứu hồ sơ, lịch sử booking và blacklist.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-3 py-2 text-sm text-[var(--apg-text-secondary)]">
            {result.total} khách hàng
          </span>
          <ExportButton
            basePath="/api/admin/customers/export"
            query={{
              blacklisted: parsedQuery.blacklisted === undefined ? undefined : String(parsedQuery.blacklisted),
              from: parsedQuery.from,
              to: parsedQuery.to,
            }}
          />
          {canCreate ? (
            <Link className="apg-btn-primary inline-flex items-center justify-center px-4" href="/admin/customers/new">
              + Thêm mới
            </Link>
          ) : null}
        </div>
      </section>

      <section className="apg-admin-toolbar px-4 py-4">
        <form className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_160px_160px_110px_auto_auto_auto] xl:items-end">
          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Tìm kiếm
            <input className="apg-field mt-2" defaultValue={parsedQuery.q ?? ""} name="q" placeholder="Tên, SĐT, email" />
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Từ ngày
            <input className="apg-field mt-2" defaultValue={parsedQuery.from ?? ""} name="from" type="date" />
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Đến ngày
            <input className="apg-field mt-2" defaultValue={parsedQuery.to ?? ""} name="to" type="date" />
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Limit
            <input className="apg-field mt-2" defaultValue={String(parsedQuery.limit)} min={1} max={100} name="limit" type="number" />
          </label>

          <label className="flex h-9 items-center gap-2 rounded-md border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-3 text-sm font-medium text-[var(--apg-text-secondary)]">
            <input defaultChecked={parsedQuery.blacklisted === true} name="blacklisted" type="checkbox" value="true" />
            Chỉ blacklist
          </label>

          <input name="offset" type="hidden" value="0" />
          <button className="apg-btn-primary w-full" type="submit">
            Lọc
          </button>
          <Link className="apg-btn-secondary inline-flex w-full items-center justify-center" href="/admin/customers">
            Xóa lọc
          </Link>
        </form>
      </section>

      <CustomerTable customers={result.items} />

      <div className="flex items-center justify-between rounded-lg border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-4 py-3">
        <Link
          className={`apg-btn-secondary ${parsedQuery.offset === 0 ? "pointer-events-none opacity-50" : ""}`}
          href={{
            pathname: "/admin/customers",
            query: {
              ...baseQuery,
              offset: String(previousOffset),
            },
          }}
        >
          Trang trước
        </Link>

        <div className="text-sm text-[var(--apg-text-secondary)]">
          Hiển thị {result.items.length} / {result.total}
        </div>

        <Link
          className={`apg-btn-secondary ${!hasNextPage ? "pointer-events-none opacity-50" : ""}`}
          href={{
            pathname: "/admin/customers",
            query: {
              ...baseQuery,
              offset: String(nextOffset),
            },
          }}
        >
          Trang sau
        </Link>
      </div>
    </div>
  );
}
