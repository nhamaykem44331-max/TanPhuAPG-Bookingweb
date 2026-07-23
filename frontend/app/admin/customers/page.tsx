import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { CustomerTable } from "@/components/admin/CustomerTable";
import { ExportButton } from "@/components/admin/ExportButton";
import { Btn, ButtonLink } from "@/components/admin/ui/Btn";
import { Field, Input } from "@/components/admin/ui/Field";
import { Panel } from "@/components/admin/ui/Panel";
import { StatTile } from "@/components/admin/ui/Stat";
import { formatNumber } from "@/lib/admin/ui/format";
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

  // ButtonLink nhận href dạng chuỗi → dựng query string tại chỗ, giữ nguyên
  // cơ chế phân trang bằng URL như cũ.
  const pageHref = (offset: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...baseQuery, offset: String(offset) })) {
      if (value) params.set(key, value);
    }
    return `/admin/customers?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <p className="max-w-[560px] text-[14px] leading-[1.55] text-[var(--ink3)]">
          Tra cứu hồ sơ, lịch sử booking và blacklist.
        </p>
        <div className="flex flex-wrap items-center gap-[10px]">
          <StatTile label="Khách hàng" value={formatNumber(result.total)} minWidth={118} />
          <ExportButton
            basePath="/api/admin/customers/export"
            query={{
              blacklisted: parsedQuery.blacklisted === undefined ? undefined : String(parsedQuery.blacklisted),
              from: parsedQuery.from,
              to: parsedQuery.to,
            }}
          />
          {canCreate ? (
            <ButtonLink href="/admin/customers/new" variant="rust" icon={<Plus size={16} strokeWidth={1.9} />}>
              Thêm mới
            </ButtonLink>
          ) : null}
        </div>
      </div>

      <Panel>
        <form className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_160px_160px_110px_auto_auto_auto] xl:items-end">
          <Field label="Tìm kiếm">
            <Input defaultValue={parsedQuery.q ?? ""} name="q" placeholder="Tên, SĐT, email" />
          </Field>

          <Field label="Từ ngày">
            <Input defaultValue={parsedQuery.from ?? ""} name="from" type="date" />
          </Field>

          <Field label="Đến ngày">
            <Input defaultValue={parsedQuery.to ?? ""} name="to" type="date" />
          </Field>

          <Field label="Limit">
            <Input defaultValue={String(parsedQuery.limit)} min={1} max={100} name="limit" type="number" mono />
          </Field>

          {/* Cao 40px + bo 9px cho khớp SearchBox/FilterTab của Manager */}
          <label className="flex h-[40px] cursor-pointer items-center gap-[9px] rounded-[9px] border border-[var(--line2)] bg-[var(--paper2)] px-[13px] text-[13px] font-medium text-[var(--ink2)]">
            <input
              defaultChecked={parsedQuery.blacklisted === true}
              name="blacklisted"
              type="checkbox"
              value="true"
              className="h-[15px] w-[15px] accent-[var(--rust)]"
            />
            Chỉ blacklist
          </label>

          <input name="offset" type="hidden" value="0" />
          <Btn type="submit" full>
            Lọc
          </Btn>
          <ButtonLink href="/admin/customers" variant="ghost" full>
            Xóa lọc
          </ButtonLink>
        </form>
      </Panel>

      <CustomerTable customers={result.items} />

      <div className="flex flex-col items-center gap-3 text-[12.5px] text-[var(--ink3)] sm:flex-row sm:justify-between">
        <ButtonLink
          href={pageHref(previousOffset)}
          variant="ghost"
          size="sm"
          icon={<ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />}
          className={`order-2 sm:order-none ${parsedQuery.offset === 0 ? "pointer-events-none opacity-40" : ""}`}
        >
          Trang trước
        </ButtonLink>

        <div className="order-1 text-center sm:order-none">
          Hiển thị <span className="ofly-num text-[var(--ink)]">{result.items.length}</span> /{" "}
          <span className="ofly-num text-[var(--ink)]">{formatNumber(result.total)}</span>
        </div>

        <ButtonLink
          href={pageHref(nextOffset)}
          variant="ghost"
          size="sm"
          className={`order-3 sm:order-none ${!hasNextPage ? "pointer-events-none opacity-40" : ""}`}
        >
          Trang sau
          <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
        </ButtonLink>
      </div>
    </div>
  );
}
