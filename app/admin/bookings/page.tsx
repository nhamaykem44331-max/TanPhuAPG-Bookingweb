import Link from "next/link";

import { BookingTable } from "@/components/admin/BookingTable";
import { ExportButton } from "@/components/admin/ExportButton";
import { ADMIN_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { listAdminBookings } from "@/lib/bookings/admin";
import { adminBookingListQuerySchema } from "@/lib/bookings/schemas";

interface AdminBookingsPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

const STATUS_TABS = [
  { value: "", label: "Tất cả" },
  { value: "HELD", label: "Held" },
  { value: "PENDING_PAYMENT", label: "Chờ thanh toán" },
  { value: "TICKETED", label: "Đã xuất" },
  { value: "EXPIRED", label: "Hết hạn" },
  { value: "CANCELLED", label: "Đã hủy" },
  { value: "PAYMENT_FAILED", label: "Lỗi" },
] as const;

function singleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminBookingsPage({ searchParams }: AdminBookingsPageProps) {
  const session = await requireRole(ADMIN_ROLES);
  const parsedQuery = adminBookingListQuerySchema.parse({
    status: singleValue(searchParams?.status),
    from: singleValue(searchParams?.from),
    to: singleValue(searchParams?.to),
    pnr: singleValue(searchParams?.pnr),
    orderCode: singleValue(searchParams?.orderCode),
    limit: singleValue(searchParams?.limit),
    offset: singleValue(searchParams?.offset),
  });
  const result = await listAdminBookings(parsedQuery, {
    userId: session.user.id,
    role: session.user.role,
  });
  const previousOffset = Math.max(parsedQuery.offset - parsedQuery.limit, 0);
  const nextOffset = parsedQuery.offset + parsedQuery.limit;
  const hasNextPage = nextOffset < result.total;
  const baseQuery = Object.fromEntries(
    Object.entries({
      status: parsedQuery.status,
      from: parsedQuery.from,
      to: parsedQuery.to,
      pnr: parsedQuery.pnr,
      orderCode: parsedQuery.orderCode,
      limit: String(parsedQuery.limit),
    }).filter((entry) => entry[1]),
  );

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-base font-semibold text-[var(--apg-text-primary)]">Bookings</h1>
          <p className="mt-1 text-sm text-[var(--apg-text-secondary)]">Quản lý theo từng PNR nhưng vẫn gom thanh toán theo mã đơn hàng.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-3 py-2 text-sm text-[var(--apg-text-secondary)]">
            {result.total} PNR
          </span>
          <ExportButton
            basePath="/api/admin/bookings/export"
            query={{
              status: parsedQuery.status,
              from: parsedQuery.from,
              to: parsedQuery.to,
              orderCode: parsedQuery.orderCode,
            }}
          />
        </div>
      </section>

      <div className="border-b border-[var(--apg-border-default)]">
        <nav className="flex gap-6 overflow-x-auto text-sm">
          {STATUS_TABS.map((tab) => {
            const active = (parsedQuery.status ?? "") === tab.value;
            const query = {
              ...baseQuery,
              status: tab.value || undefined,
              offset: "0",
            };

            return (
              <Link
                key={tab.value || "all"}
                className={`whitespace-nowrap border-b-2 px-1 pb-3 transition ${
                  active
                    ? "border-[var(--apg-text-primary)] font-semibold text-[var(--apg-text-primary)]"
                    : "border-transparent text-[var(--apg-text-secondary)] hover:text-[var(--apg-text-primary)]"
                }`}
                href={{ pathname: "/admin/bookings", query }}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <section className="apg-admin-toolbar px-4 py-4">
        <form className="grid gap-3 xl:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_160px_160px_110px_auto_auto] xl:items-end">
          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            PNR
            <input className="apg-field mt-2" defaultValue={parsedQuery.pnr ?? ""} name="pnr" placeholder="63JTXF" />
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Mã đơn hàng
            <input className="apg-field mt-2" defaultValue={parsedQuery.orderCode ?? ""} name="orderCode" placeholder="APG-260425-XXXXXX" />
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

          <input name="status" type="hidden" value={parsedQuery.status ?? ""} />
          <input name="offset" type="hidden" value="0" />
          <button className="apg-btn-primary w-full" type="submit">
            Lọc
          </button>
          <Link className="apg-btn-secondary inline-flex w-full items-center justify-center" href="/admin/bookings">
            Xóa lọc
          </Link>
        </form>
      </section>

      <BookingTable bookings={result.items} />

      <div className="flex items-center justify-between rounded-lg border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-4 py-3">
        <Link
          className={`apg-btn-secondary ${parsedQuery.offset === 0 ? "pointer-events-none opacity-50" : ""}`}
          href={{
            pathname: "/admin/bookings",
            query: {
              ...baseQuery,
              offset: String(previousOffset),
            },
          }}
        >
          Trang trước
        </Link>

        <div className="text-sm text-[var(--apg-text-secondary)]">
          Hiển thị {result.items.length} / {result.total} PNR
        </div>

        <Link
          className={`apg-btn-secondary ${!hasNextPage ? "pointer-events-none opacity-50" : ""}`}
          href={{
            pathname: "/admin/bookings",
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
