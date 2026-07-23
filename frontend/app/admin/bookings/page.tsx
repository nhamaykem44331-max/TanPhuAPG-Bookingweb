import { BookingStatus } from "@prisma/client";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Btn, ButtonLink } from "@/components/admin/ui/Btn";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/DataTable";
import { MiniChip, StatusChip } from "@/components/admin/ui/Chip";
import { SearchBox } from "@/components/admin/ui/Field";
import { FilterTab } from "@/components/admin/ui/Tabs";
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
// Mốc thời gian là số → mono theo quy ước bảng của Manager.
function HoldExpiryCell({ row }: { row: AdminBookingRecord }) {
  if (!HOLD_ACTIVE_STATUSES.has(row.status as BookingStatus) || !row.holdExpiresAt) {
    return <span className="text-[13px] text-[var(--ink4)]">—</span>;
  }

  const stamp = formatDateTime(row.holdExpiresAt);
  const msLeft = new Date(row.holdExpiresAt).getTime() - Date.now();

  if (msLeft < 0) {
    return (
      <div className="min-w-0">
        <div className="text-[12.5px] font-medium text-[var(--ink4)]">Đã hết hạn</div>
        <div className="ofly-num mt-[2px] truncate text-[11px] text-[var(--ink4)]">{stamp}</div>
      </div>
    );
  }

  const minutesLeft = Math.floor(msLeft / 60_000);
  return (
    <div className="min-w-0">
      {minutesLeft < 120 ? (
        <MiniChip tone="red">Còn {formatHoldCountdown(minutesLeft)}</MiniChip>
      ) : (
        <div className="ofly-num text-[12.5px] font-semibold text-[var(--ink)]">
          Còn {formatHoldCountdown(minutesLeft)}
        </div>
      )}
      <div className="ofly-num mt-[3px] truncate text-[11px] text-[var(--ink3)]">{stamp}</div>
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
  // FilterTab/ButtonLink nhận href dạng chuỗi → dựng query string tại chỗ, giữ nguyên
  // cơ chế lọc/phân trang bằng URL như cũ.
  const hrefWith = (query: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    return `/admin/bookings?${params.toString()}`;
  };
  const tabHref = (tab: OrderTabKey) => hrefWith({ tab, ...(searchTerm ? { q: searchTerm } : {}) });

  const columns: DataTableColumn<AdminBookingRecord>[] = [
    {
      key: "pnr",
      header: "PNR",
      width: "104px",
      render: (row) => (
        <span className="ofly-num text-[13px] font-semibold text-[var(--rust)]">{row.pnr || "—"}</span>
      ),
    },
    {
      key: "route",
      header: "CHẶNG BAY",
      width: "minmax(0,1.3fr)",
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold text-[var(--ink)]">{formatRoute(row.route)}</div>
          <div className="mt-[3px] truncate text-[11.5px] text-[var(--ink3)]">
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
          <div className="truncate text-[13.5px] font-medium text-[var(--ink)]">{row.customerName ?? "—"}</div>
          <div className="mt-[2px] text-[11.5px] text-[var(--ink3)]">
            <span className="ofly-num">{row.passengerCount}</span> khách
          </div>
        </div>
      ),
    },
    {
      key: "amount",
      header: "SỐ TIỀN",
      width: "138px",
      align: "right",
      render: (row) => (
        <span className="ofly-num text-[13.5px] font-semibold text-[var(--ink)]">{formatVnd(row.sellPrice)}</span>
      ),
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
        <span
          className="truncate text-[12.5px]"
          style={{ color: row.assignedToName ? "var(--ink2)" : "var(--ink4)" }}
        >
          {row.assignedToName ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <div>
      {/* Thanh công cụ kiểu Manager: tab lọc bên trái (cuộn ngang trên mobile), ô tìm bên phải */}
      <div className="mb-[16px] flex flex-col gap-[12px] xl:flex-row xl:items-center xl:justify-between">
        <div className="ofly-hscroll -mx-4 flex gap-[8px] overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {TAB_ORDER.map((tab) => (
            <FilterTab
              key={tab}
              href={tabHref(tab)}
              active={currentTab === tab}
              count={formatNumber(tabCount(tab))}
              className="flex-none"
            >
              {TAB_LABELS[tab]}
            </FilterTab>
          ))}
        </div>

        <form action="/admin/bookings" className="flex w-full min-w-0 items-center gap-[8px] xl:w-auto">
          <input type="hidden" name="tab" value={currentTab} />
          <SearchBox
            name="q"
            defaultValue={searchTerm}
            placeholder="Tìm PNR, mã đơn, khách, chặng…"
            wrapperClassName="min-w-0 flex-1 xl:w-[300px] xl:flex-none"
          />
          <Btn type="submit" variant="ghost" size="sm" className="h-[40px] flex-none">
            Tìm
          </Btn>
        </form>
      </div>

      <DataTable
        columns={columns}
        rows={result.items}
        getRowKey={(row) => row.pnrRecordId}
        rowHref={(row) => `/admin/bookings/${row.id}`}
        empty={searchTerm ? `Không có đơn nào khớp “${searchTerm}”.` : "Chưa có đơn nào trong nhóm này."}
      />

      {/* Phân trang kiểu Manager: đếm bên trái, hai nút mũi tên bên phải */}
      <div className="mt-[14px] flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <span className="text-[12.5px] text-[var(--ink3)]">
          Hiển thị <span className="ofly-num text-[var(--ink2)]">{result.items.length}</span> /{" "}
          <span className="ofly-num text-[var(--ink2)]">{result.total}</span> PNR
        </span>
        {/* Hết trang thì render <button disabled> thay vì <Link>: pointer-events:none chỉ chặn
            chuột, link vẫn nằm trong tab order và bấm Enter được → nhảy sang trang không tồn tại. */}
        <div className="flex items-center gap-[6px]">
          {parsedQuery.offset === 0 ? (
            <Btn
              variant="ghost"
              size="sm"
              disabled
              icon={<ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />}
            >
              Trang trước
            </Btn>
          ) : (
            <ButtonLink
              href={hrefWith(pageQuery(previousOffset))}
              variant="ghost"
              size="sm"
              icon={<ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />}
            >
              Trang trước
            </ButtonLink>
          )}
          {hasNextPage ? (
            <ButtonLink href={hrefWith(pageQuery(nextOffset))} variant="ghost" size="sm">
              Trang sau
              <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </ButtonLink>
          ) : (
            <Btn variant="ghost" size="sm" disabled>
              Trang sau
              <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}
