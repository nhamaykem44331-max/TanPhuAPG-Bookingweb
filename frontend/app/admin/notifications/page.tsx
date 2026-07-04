import { MiniChip } from "@/components/admin/ui/Chip";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/DataTable";
import { formatRoute, formatTime } from "@/lib/admin/ui/format";
import { toneVars, type Tone } from "@/lib/admin/ui/tones";
import { ADMIN_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// 00:00 hôm nay theo giờ VN — mốc đếm "tin đã gửi trong ngày" cho thẻ kênh.
function startOfTodayVN(): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${ymd}T00:00:00+07:00`);
}

interface ChannelMeta {
  channel: string;
  name: string;
  chipLabel: string;
  tone: Tone;
  desc: string;
}

const CHANNEL_CARDS: ChannelMeta[] = [
  {
    channel: "ZALO_OA",
    name: "Zalo OA",
    chipLabel: "Kênh chính",
    tone: "ok",
    desc: "Kênh chính cho cảnh báo nội bộ: cần xuất vé, quá SLA, sắp hết hạn giữ chỗ.",
  },
  {
    channel: "ZNS",
    name: "ZNS",
    chipLabel: "Khách hàng",
    tone: "info",
    desc: "Tin chính thức gửi khách: xác nhận giữ chỗ, link thanh toán, vé điện tử, hoàn tiền.",
  },
  {
    channel: "TELEGRAM",
    name: "Telegram",
    chipLabel: "Dự phòng",
    tone: "warn",
    desc: "Dự phòng khi khẩn cấp — chỉ kích hoạt cho cảnh báo quá SLA / không xuất được.",
  },
];

const CHANNEL_LABELS: Record<string, string> = {
  ZALO_OA: "Zalo OA",
  ZNS: "ZNS",
  TELEGRAM: "Telegram",
  EMAIL: "Email",
  SLACK: "Slack",
  INTERNAL: "Nội bộ",
};

interface NotifRow {
  id: string;
  type: string;
  audience: string;
  channel: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  pnr: string | null;
  route: string | null;
}

// NotificationJobStatus → nhãn + màu chữ (cột trạng thái là text màu, không phải chip).
function statusText(row: NotifRow): { label: string; color: string } {
  switch (row.status) {
    case "SENT":
      return { label: "Đã gửi", color: toneVars("ok").fg };
    case "PENDING":
    case "PROCESSING":
      return { label: "Đang chờ", color: toneVars("warn").fg };
    case "FAILED":
      return row.attempts > 0 && row.attempts < row.maxAttempts
        ? { label: `Thử lại (${row.attempts}/${row.maxAttempts})`, color: toneVars("warn").fg }
        : { label: "Thất bại", color: toneVars("red").fg };
    case "CANCELLED":
      return { label: "Đã huỷ", color: toneVars("muted").fg };
    case "SKIPPED":
      return { label: "Bỏ qua", color: toneVars("muted").fg };
    default:
      return { label: row.status, color: toneVars("muted").fg };
  }
}

export default async function AdminNotificationsPage() {
  await requireRole(ADMIN_ROLES);

  const [channelCounts, jobs] = await Promise.all([
    prisma.notificationJob.groupBy({
      by: ["channel"],
      where: { status: "SENT", sentAt: { gte: startOfTodayVN() } },
      _count: { _all: true },
    }),
    prisma.notificationJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        type: true,
        audience: true,
        channel: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        createdAt: true,
        booking: { select: { pnr: true, routeSummary: true } },
      },
    }),
  ]);

  const sentByChannel = new Map(channelCounts.map((row) => [row.channel as string, row._count._all]));
  const rows: NotifRow[] = jobs.map((job) => ({
    id: job.id,
    type: job.type,
    audience: job.audience,
    channel: job.channel,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    createdAt: job.createdAt.toISOString(),
    pnr: job.booking?.pnr ?? null,
    route: job.booking?.routeSummary ?? null,
  }));

  const columns: DataTableColumn<NotifRow>[] = [
    {
      key: "time",
      header: "GIỜ",
      width: "60px",
      render: (row) => <span className="text-[12px] text-[var(--ink-soft)]">{formatTime(row.createdAt)}</span>,
    },
    {
      key: "event",
      header: "SỰ KIỆN",
      width: "minmax(0,1.5fr)",
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium">{row.type}</div>
          {row.pnr || row.route ? (
            <div className="mt-[2px] truncate text-[11px] text-[var(--ink-soft)]">
              {[row.pnr, row.route ? formatRoute(row.route) : null].filter(Boolean).join(" · ")}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "channel",
      header: "KÊNH",
      width: "128px",
      render: (row) => (
        <span className="text-[12px] text-[var(--ink-soft)]">{CHANNEL_LABELS[row.channel] ?? row.channel}</span>
      ),
    },
    {
      key: "audience",
      header: "ĐỐI TƯỢNG",
      width: "96px",
      render: (row) =>
        row.audience === "CUSTOMER" ? <MiniChip tone="info">Khách</MiniChip> : <MiniChip tone="rust">Nội bộ</MiniChip>,
    },
    {
      key: "status",
      header: "TRẠNG THÁI",
      width: "128px",
      render: (row) => {
        const status = statusText(row);
        return (
          <span className="text-[12px] font-semibold" style={{ color: status.color }}>
            {status.label}
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {CHANNEL_CARDS.map((card) => (
          <div key={card.channel} className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-[22px] py-[20px]">
            <div className="flex items-center justify-between">
              <span className="ofly-serif text-[17px] font-medium">{card.name}</span>
              <MiniChip tone={card.tone}>{card.chipLabel}</MiniChip>
            </div>
            <div className="mt-[9px] text-[12px] leading-[1.5] text-[var(--ink-soft)]">{card.desc}</div>
            <div className="mt-[14px] text-[12px] text-[var(--ink-soft)]">
              Hôm nay:{" "}
              <strong className="ofly-serif text-[15px] font-medium text-[var(--ink)]">
                {sentByChannel.get(card.channel) ?? 0}
              </strong>{" "}
              tin
            </div>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        empty="Chưa có thông báo nào được gửi."
        className="overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]"
      />
    </div>
  );
}
