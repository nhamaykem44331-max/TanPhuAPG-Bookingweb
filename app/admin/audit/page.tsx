import Link from "next/link";

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
  const pageQuery = (value: number) => (value > 0 ? { offset: String(value) } : {});

  const columns: DataTableColumn<AuditRow>[] = [
    {
      key: "time",
      header: "THỜI GIAN",
      width: "130px",
      render: (row) => <span className="text-[12px] text-[var(--ink-soft)]">{row.time}</span>,
    },
    {
      key: "who",
      header: "NGƯỜI THỰC HIỆN",
      width: "140px",
      render: (row) => <span className="text-[13px] font-medium">{row.who}</span>,
    },
    {
      key: "action",
      header: "HÀNH ĐỘNG",
      width: "minmax(0,1fr)",
      render: (row) => <span className="text-[13px] text-[var(--ink-soft)]">{row.action}</span>,
    },
    {
      key: "order",
      header: "ĐƠN",
      width: "110px",
      render: (row) => {
        const ref = orderRef(row);
        return ref ? (
          <span className="ofly-sans text-[12px] font-semibold tracking-[1px] text-[var(--rust)]">{ref}</span>
        ) : (
          <span className="text-[12px] text-[var(--ink-faint)]">—</span>
        );
      },
    },
  ];

  return (
    <div>
      <p className="mb-[22px] max-w-[560px] text-[14px] leading-[1.6] text-[var(--ink-soft)]">
        Nhật ký thao tác nghiệp vụ trong <strong className="font-semibold text-[var(--ink)]">7 ngày gần nhất</strong>:
        xuất vé, đối soát, hoàn tiền, cập nhật cấu hình và phân quyền.
      </p>

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        empty="Chưa có nhật ký nào trong 7 ngày qua."
        className="overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]"
      />

      <div className="mt-4 flex items-center justify-between text-[12px] text-[var(--ink-soft)]">
        <Link
          href={{ pathname: "/admin/audit", query: pageQuery(previousOffset) }}
          className={`rounded-[8px] border border-[var(--line-strong)] px-[14px] py-[8px] font-medium transition hover:border-[var(--ink)] hover:text-[var(--ink)] ${
            offset === 0 ? "pointer-events-none opacity-40" : ""
          }`}
        >
          Trang trước
        </Link>
        <span>
          Hiển thị {rows.length} / {formatNumber(total)} nhật ký
        </span>
        <Link
          href={{ pathname: "/admin/audit", query: pageQuery(nextOffset) }}
          className={`rounded-[8px] border border-[var(--line-strong)] px-[14px] py-[8px] font-medium transition hover:border-[var(--ink)] hover:text-[var(--ink)] ${
            !hasNextPage ? "pointer-events-none opacity-40" : ""
          }`}
        >
          Trang sau
        </Link>
      </div>
    </div>
  );
}
