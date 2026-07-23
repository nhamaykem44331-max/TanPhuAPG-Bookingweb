import { BookingStatus } from "@prisma/client";

import { QueueList } from "@/components/admin/queue/QueueList";
import { StatTile, type StatTileTone } from "@/components/admin/ui/Stat";
import { FilterTab } from "@/components/admin/ui/Tabs";
import { TICKETING_QUEUE_ROLES } from "@/lib/auth/constants";
import { bookingListWhereForRole } from "@/lib/auth/ownership";
import { requireRole } from "@/lib/auth/requireRole";
import { listTicketingQueue } from "@/lib/bookings/ticketingQueue";
import { ticketingQueueQuerySchema } from "@/lib/bookings/schemas";
import { formatNumber } from "@/lib/admin/ui/format";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const QUEUE_STATUSES: BookingStatus[] = [BookingStatus.PAID, BookingStatus.TICKETING];
const DUE_SOON_WINDOW_MINUTES = 10;

interface QueuePageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

function singleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Ô KPI đầu trang — tone theo mức khẩn (Manager: StatTile plain/rust/amber/red).
interface QueueStat {
  label: string;
  value: number;
  tone: StatTileTone;
}

export default async function QueuePage({ searchParams }: QueuePageProps) {
  const session = await requireRole(TICKETING_QUEUE_ROLES);
  const ownership = { userId: session.user.id, role: session.user.role };

  const query = ticketingQueueQuerySchema.parse({
    assignedToId: singleValue(searchParams?.assignedToId),
    unassigned: singleValue(searchParams?.unassigned),
    overdueOnly: singleValue(searchParams?.overdueOnly),
    limit: singleValue(searchParams?.limit),
    offset: singleValue(searchParams?.offset),
  });

  // Gộp 1 đợt: danh sách hàng đợi và 2 count không phụ thuộc nhau — tách 2 await
  // là mất thêm một round-trip DB (~100ms mỗi lượt vì DB ở region xa).
  const now = Date.now();
  const [result, statusCounts, dueSoonCount] = await Promise.all([
    listTicketingQueue(query, ownership),
    prisma.booking.groupBy({
      by: ["status"],
      where: bookingListWhereForRole(ownership, { status: { in: QUEUE_STATUSES } }),
      _count: { _all: true },
    }),
    prisma.booking.count({
      where: bookingListWhereForRole(ownership, {
        status: BookingStatus.PAID,
        slaDueAt: { gte: new Date(now), lte: new Date(now + DUE_SOON_WINDOW_MINUTES * 60_000) },
      }),
    }),
  ]);

  const paidCount = statusCounts.find((row) => row.status === BookingStatus.PAID)?._count._all ?? 0;
  const ticketingCount = statusCounts.find((row) => row.status === BookingStatus.TICKETING)?._count._all ?? 0;

  const stats: QueueStat[] = [
    { label: "Chờ xuất vé", value: paidCount, tone: "rust" },
    { label: "Sắp trễ SLA", value: dueSoonCount, tone: "amber" },
    { label: "Quá SLA", value: result.overdue, tone: "red" },
    { label: "Đang xuất", value: ticketingCount, tone: "plain" },
  ];

  const noFilter = !query.unassigned && !query.overdueOnly;

  return (
    <div>
      {/* Dáng PageHead của Manager nhưng KHÔNG lặp h1: tiêu đề trang đã do Topbar dựng. */}
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-6">
        <p className="m-0 max-w-[560px] text-[14px] leading-[1.55] text-[var(--ink3)]">
          Đơn <strong className="font-semibold text-[var(--ink)]">đã thanh toán nhưng chưa có vé</strong> — khe rủi ro lớn
          nhất. Mỗi đơn cần được xuất trong vòng 30 phút. Nhận xử lý để khoá đơn về tên bạn.
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-[10px]">
          {stats.map((stat) => (
            <StatTile
              key={stat.label}
              label={stat.label}
              value={formatNumber(stat.value)}
              tone={stat.tone}
              minWidth={118}
            />
          ))}
        </div>
      </div>

      {/* Lọc bằng query string (schema đã hỗ trợ sẵn) nên FilterTab render dạng <Link>. */}
      <div className="ofly-hscroll mb-[14px] flex flex-nowrap items-center gap-2 overflow-x-auto">
        <FilterTab href="/admin/queue" active={noFilter} count={formatNumber(paidCount + ticketingCount)}>
          Tất cả
        </FilterTab>
        <FilterTab href="/admin/queue?unassigned=true" active={query.unassigned} count={formatNumber(result.unassigned)}>
          Chưa nhận
        </FilterTab>
        <FilterTab href="/admin/queue?overdueOnly=true" active={query.overdueOnly} count={formatNumber(result.overdue)}>
          Quá SLA
        </FilterTab>
      </div>

      <QueueList items={result.items} currentUserName={session.user.fullName ?? "Bạn"} />
    </div>
  );
}
