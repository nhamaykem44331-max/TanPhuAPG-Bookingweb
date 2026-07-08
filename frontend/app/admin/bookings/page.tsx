import { BookingStatus } from "@prisma/client";
import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/admin/ui/DataTable";
import { MiniChip, StatusChip } from "@/components/admin/ui/Chip";
import { ADMIN_ROLES } from "@/lib/auth/constants";
import { bookingListWhereForRole } from "@/lib/auth/ownership";
import { requireRole } from "@/lib/auth/requireRole";
import { ORDER_TAB_STATUSES, listAdminBookings, type AdminBookingRecord } from "@/lib/bookings/admin";
import { adminBookingListQuerySchema, type OrderTabKey } from "@/lib/bookings/schemas";
import { formatDate, formatDateTime, formatNumber, formatRoute, formatVnd } from "@/lib/admin/ui/format";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface AdminBookingsPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

const TAB_LABELS: Record<OrderTabKey, string> = {
  all: "Tất cả",
  queue: "Chờ xuất",
  held: "Đang giữ",
  pending: "Chờ TT",
  ticketed: "Đã xuất",
  refund: "Cần hoàn",
  closed: "Đã đóng",
};

const TAB_ORDER: OrderTabKey[] = ["all", "queue", "held", "pending", "ticketed", "refund", "closed"];

function singleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// "1g45p" / "45p" — đếm ngược ngắn gọn cho hạn giữ chỗ.
function formatHoldCountdown(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}g${mins.toString().padStart(2, "0")}p` : `${mins}p`;
}

// Chỉ đơn còn giữ chỗ (HELD/PENDING_PAYMENT) mới có hạn giữ chỗ còn ý nghĩa.
const HOLD_ACTIVE_STATUSES = new Set<BookingStatus>([BookingStatus.HELD, BookingStatus.PENDING_PAYMENT]);

// Ô "Hạn giữ chỗ": PNR sắp hết hạn (dưới 2 tiếng) tô đỏ nổi bật để admin lưu ý.
function HoldExpiryCell({ row }: { row: AdminBookingRecord }) {
  if (!HOLD_ACTIVE_STATUSES.has(row.status as BookingStatus) || !row.holdExpiresAt) {
    return <span className="text-[12px] text-[var(--ink-faint)]">—</span>;
  }

  const stamp = formatDateTime(row.holdExpiresAt);
  const msLeft = new Date(row.holdExpiresAt).getTime() - Date.now();

  if (msLeft < 0) {
    return (
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-[var(--ink-faint)]">Đã hết hạn</div>
        <div className="mt-[2px] truncate text-[11px] text-[var(--ink-faint)]">{stamp}</div>
      </div>
    );
  }

  const minutesLeft = Math.floor(msLeft / 60_000);
  return (
    <div className="min-w-0">
      {minutesLeft < 120 ? (
        <MiniChip tone="red">Còn {formatHoldCountdown(minutesLeft)}</MiniChip>
      ) : (
        <div className="text-[12px] font-medium text-[var(--ink)]">Còn {formatHoldCountdown(minutesLeft)}</div>
      )}
      <div className="mt-[3px] truncate text-[11px] text-[var(--ink-soft)]">{stamp}</div>
    </div>
  );
}

export default async function AdminBookingsPage({ searchParams }: AdminBookingsPageProps) {
  const session = await requireRole(ADMIN_ROLES);
  const ownership = { userId: session.user.id, role: session.user.role };

  const parsedQuery = adminBookingListQuerySchema.parse({
    tab: singleValue(searchParams?.tab),
    q: singleValue(searchParams?.q),
    limit: singleValue(searchParams?.limit),
    offset: singleValue(searchParams?.offset),
  });
  const currentTab: OrderTabKey = parsedQuery.tab ?? "all";
  const searchTerm = parsedQuery.q ?? "";

  const [result, statusCounts] = await Promise.all([
    listAdminBookings(parsedQuery, ownership),
    prisma.booking.groupBy({
      by: ["status"],
      where: bookingListWhereForRole(ownership, {}),
      _count: { _all: true },
    }),
  ]);

  const countByStatus = new Map(statusCounts.map((row) => [row.status, row._count._all]));
  const grandTotal = statusCounts.reduce((acc, row) => acc + row._count._all, 0);
  const tabCount = (tab: OrderTabKey): number =>
    tab === "all" ? grandTotal : ORDER_TAB_STATUSES[tab].reduce((acc, status) => acc + (countByStatus.get(status) ?? 0), 0);

  const previousOffset = Math.max(parsedQuery.offset - parsedQuery.limit, 0);
  const nextOffset = parsedQuery.offset + parsedQuery.limit;
  const hasNextPage = nextOffset < result.total;
  const pageQuery = (offset: number) => ({
    tab: currentTab,
    ...(searchTerm ? { q: searchTerm } : {}),
    ...(offset > 0 ? { offset: String(offset) } : {}),
  });

  const columns: DataTableColumn<AdminBookingRecord>[] = [
    {
      key: "pnr",
      header: "PNR",
      width: "104px",
      render: (row) => (
        <span className="ofly-sans text-[13px] font-semibold tracking-[1px] text-[var(--rust)]">{row.pnr || "—"}</span>
      ),
    },
    {
      key: "route",
      header: "CHẶNG BAY",
      width: "minmax(0,1.3fr)",
      render: (row) => (
        <div className="min-w-0">
          <div className="ofly-serif text-[15px] font-medium tracking-[0.4px]">{formatRoute(row.route)}</div>
          <div className="mt-[3px] truncate text-[11px] text-[var(--ink-soft)]">
            {[row.airline, formatDate(row.departureDate, "")].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>
      ),
    },
    {
      key: "customer",
      header: "KHÁCH",
      width: "minmax(0,1fr)",
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium">{row.customerName ?? "—"}</div>
          <div className="mt-[2px] text-[11px] text-[var(--ink-soft)]">{row.passengerCount} khách</div>
        </div>
      ),
    },
    {
      key: "amount",
      header: "SỐ TIỀN",
      width: "128px",
      render: (row) => <span className="ofly-serif text-[15px] font-medium">{formatVnd(row.sellPrice)}</span>,
    },
    {
      key: "status",
      header: "TRẠNG THÁI",
      width: "168px",
      render: (row) => <StatusChip status={row.status as BookingStatus} />,
    },
    {
      key: "holdExpiry",
      header: "HẠN GIỮ CHỖ",
      width: "150px",
      render: (row) => <HoldExpiryCell row={row} />,
    },
    {
      key: "assignee",
      header: "PHỤ TRÁCH",
      width: "116px",
      render: (row) => (
        <span className="text-[12px]" style={{ color: row.assignedToName ? "var(--ink)" : "var(--ink-faint)" }}>
          {row.assignedToName ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-[6px]">
          {TAB_ORDER.map((tab) => {
            const active = currentTab === tab;
            return (
              <Link
                key={tab}
                href={{ pathname: "/admin/bookings", query: { tab, ...(searchTerm ? { q: searchTerm } : {}) } }}
                className="rounded-[8px] border px-[14px] py-[8px] text-[12px] font-medium leading-none transition"
                style={
                  active
                    ? { borderColor: "var(--rust)", background: "var(--rust)", color: "#F5F1EA" }
                    : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-soft)" }
                }
              >
                {TAB_LABELS[tab]} <span className="opacity-60">{formatNumber(tabCount(tab))}</span>
              </Link>
            );
          })}
        </div>

        <form action="/admin/bookings" className="flex w-full items-center gap-2 sm:w-auto">
          <input type="hidden" name="tab" value={currentTab} />
          <input
            name="q"
            defaultValue={searchTerm}
            placeholder="Tìm PNR, mã đơn, khách, chặng…"
            className="min-w-0 flex-1 rounded-[8px] border border-[var(--line)] bg-[var(--surface)] px-[12px] py-[8px] text-[13px] text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-faint)] focus:border-[var(--line-strong)] sm:w-[260px] sm:flex-none"
          />
          <button
            type="submit"
            className="rounded-[8px] border border-[var(--line-strong)] bg-transparent px-[14px] py-[8px] text-[12px] font-medium text-[var(--ink-soft)] transition hover:border-[var(--ink)] hover:text-[var(--ink)]"
          >
            Tìm
          </button>
        </form>
      </div>

      <DataTable
        columns={columns}
        rows={result.items}
        getRowKey={(row) => row.pnrRecordId}
        rowHref={(row) => `/admin/bookings/${row.id}`}
        empty={searchTerm ? `Không có đơn nào khớp “${searchTerm}”.` : "Chưa có đơn nào trong nhóm này."}
        className="overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]"
      />

      <div className="mt-4 flex flex-col items-center gap-3 text-[12px] text-[var(--ink-soft)] sm:flex-row sm:justify-between">
        <Link
          href={{ pathname: "/admin/bookings", query: pageQuery(previousOffset) }}
          className={`order-2 whitespace-nowrap rounded-[8px] border border-[var(--line-strong)] px-[14px] py-[8px] font-medium transition hover:border-[var(--ink)] hover:text-[var(--ink)] sm:order-none ${
            parsedQuery.offset === 0 ? "pointer-events-none opacity-40" : ""
          }`}
        >
          Trang trước
        </Link>
        <span className="order-1 text-center sm:order-none">
          Hiển thị {result.items.length} / {result.total} PNR
        </span>
        <Link
          href={{ pathname: "/admin/bookings", query: pageQuery(nextOffset) }}
          className={`order-3 whitespace-nowrap rounded-[8px] border border-[var(--line-strong)] px-[14px] py-[8px] font-medium transition hover:border-[var(--ink)] hover:text-[var(--ink)] sm:order-none ${
            !hasNextPage ? "pointer-events-none opacity-40" : ""
          }`}
        >
          Trang sau
        </Link>
      </div>
    </div>
  );
}
