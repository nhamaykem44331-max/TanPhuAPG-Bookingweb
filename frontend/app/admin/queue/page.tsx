import { BookingStatus } from "@prisma/client";

import { QueueList } from "@/components/admin/queue/QueueList";
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

interface StatCard {
  label: string;
  value: number;
  color: string;
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

  const result = await listTicketingQueue(query, ownership);

  const now = Date.now();
  const [statusCounts, dueSoonCount] = await Promise.all([
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

  const stats: StatCard[] = [
    { label: "Chờ xuất vé", value: paidCount, color: "var(--tone-rust-fg)" },
    { label: "Sắp trễ SLA", value: dueSoonCount, color: "var(--tone-warn-fg)" },
    { label: "Quá SLA", value: result.overdue, color: "var(--tone-rust-fg)" },
    { label: "Đang xuất", value: ticketingCount, color: "var(--ink)" },
  ];

  return (
    <div>
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-5">
        <p className="max-w-[560px] text-[14px] leading-[1.6] text-[var(--ink-soft)]">
          Đơn <strong className="font-semibold text-[var(--ink)]">đã thanh toán nhưng chưa có vé</strong> — khe rủi ro lớn
          nhất. Mỗi đơn cần được xuất trong vòng 30 phút. Nhận xử lý để khoá đơn về tên bạn.
        </p>
        <div className="flex gap-[10px]">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="min-w-[118px] rounded-[8px] border border-[var(--line)] bg-[var(--surface)] px-[15px] py-[13px]"
            >
              <div className="ofly-serif text-[30px] font-medium leading-none" style={{ color: stat.color }}>
                {formatNumber(stat.value)}
              </div>
              <div className="mt-[6px] text-[11px] font-medium text-[var(--ink-soft)]">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <QueueList items={result.items} currentUserName={session.user.fullName ?? "Bạn"} />
    </div>
  );
}
