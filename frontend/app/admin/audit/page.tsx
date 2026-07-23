import { ChevronLeft, ChevronRight } from "lucide-react";

import { ButtonLink } from "@/components/admin/ui/Btn";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/DataTable";
import { formatNumber, formatTime } from "@/lib/admin/ui/format";
import { buildAuditSummary } from "@/lib/audit/summary";
import { AUDIT_VIEWER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface AdminAuditPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

const PAGE_SIZE = 40;

// Ngày/tháng giờ VN cho cột THỜI GIAN ("18/06"), ghép với formatTime → "18/06 · 14:25".
const DAY_MONTH_FMT = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

function singleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function sevenDaysAgo(): Date {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date;
}

function auditTime(iso: string): string {
  return `${DAY_MONTH_FMT.format(new Date(iso))} · ${formatTime(iso)}`;
}

interface AuditRow {
  id: string;
  time: string;
  who: string;
  action: string;
  entity: string;
  entityId: string;
}

// Mã đơn ngắn (6 ký tự cuối) cho cột ĐƠN khi entity là Booking; còn lại không hiển thị.
function orderRef(row: AuditRow): string | null {
  return row.entity === "Booking" ? row.entityId.slice(-6).toUpperCase() : null;
}

export default async function AdminAuditPage({ searchParams }: AdminAuditPageProps) {
  await requireRole(AUDIT_VIEWER_ROLES);

  const offset = Math.max(Number(singleValue(searchParams?.offset) ?? 0) || 0, 0);
  const where = { createdAt: { gte: sevenDaysAgo() } };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: PAGE_SIZE,
      include: { actor: { select: { email: true, fullName: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  const rows: AuditRow[] = logs.map((log) => ({
    id: log.id,
    time: auditTime(log.createdAt.toISOString()),
    who: log.actor?.email ?? "system",
    action: buildAuditSummary(log),
    entity: log.entity,
    entityId: log.entityId,
  }));

  const previousOffset = Math.max(offset - PAGE_SIZE, 0);
  const nextOffset = offset + PAGE_SIZE;
  const hasNextPage = nextOffset < total;
  // ButtonLink nhận href dạng chuỗi nên dựng sẵn query offset ở đây.
  const pageHref = (value: number) => (value > 0 ? `/admin/audit?offset=${value}` : "/admin/audit");

  const columns: DataTableColumn<AuditRow>[] = [
    {
      key: "time",
      header: "THỜI GIAN",
      width: "148px",
      // ofly-num (không phải ofly-mono) để có tabular-nums → cột thời gian thẳng hàng như ở payments/bookings.
      render: (row) => <span className="ofly-num text-[12px] text-[var(--ink3)]">{row.time}</span>,
    },
    {
      key: "who",
      header: "NGƯỜI THỰC HIỆN",
      width: "180px",
      render: (row) => (
        <span className="block truncate text-[13px] font-semibold text-[var(--ink)]">{row.who}</span>
      ),
    },
    {
      key: "action",
      header: "HÀNH ĐỘNG",
      width: "minmax(0,1fr)",
      render: (row) => <span className="text-[13.5px] text-[var(--ink2)]">{row.action}</span>,
    },
    {
      key: "order",
      header: "ĐƠN",
      width: "110px",
      render: (row) => {
        const ref = orderRef(row);
        // Mã đơn là mã kỹ thuật → ofly-num (mono + tabular-nums, §6) để các mã xếp thẳng cột.
        return ref ? (
          <span className="ofly-num text-[12px] font-bold tracking-[0.6px] text-[var(--rust)]">{ref}</span>
        ) : (
          <span className="text-[12px] text-[var(--ink4)]">—</span>
        );
      },
    },
  ];

  return (
    <div>
      <p className="mb-[22px] max-w-[580px] text-[14px] leading-[1.55] text-[var(--ink3)]">
        Nhật ký thao tác nghiệp vụ trong <strong className="font-semibold text-[var(--ink)]">7 ngày gần nhất</strong>:
        xuất vé, đối soát, hoàn tiền, cập nhật cấu hình và phân quyền.
      </p>

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        empty="Chưa có nhật ký nào trong 7 ngày qua."
      />

      <div className="mt-[14px] flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-[var(--ink3)]">
        {/* Trang đầu/cuối: khoá bằng pointer-events + mờ, giữ nguyên hành vi cũ */}
        <ButtonLink
          href={pageHref(previousOffset)}
          variant="ghost"
          size="sm"
          icon={<ChevronLeft size={15} strokeWidth={1.5} aria-hidden="true" />}
          className={offset === 0 ? "pointer-events-none opacity-40" : ""}
        >
          Trang trước
        </ButtonLink>
        <span className="order-last w-full text-center sm:order-none sm:w-auto">
          Hiển thị <span className="ofly-num text-[var(--ink2)]">{rows.length}</span> /{" "}
          <span className="ofly-num text-[var(--ink2)]">{formatNumber(total)}</span> nhật ký
        </span>
        <ButtonLink
          href={pageHref(nextOffset)}
          variant="ghost"
          size="sm"
          className={!hasNextPage ? "pointer-events-none opacity-40" : ""}
        >
          Trang sau
          <ChevronRight size={15} strokeWidth={1.5} aria-hidden="true" />
        </ButtonLink>
      </div>
    </div>
  );
}
