import { BellRing, MessageSquare, Send, type LucideIcon } from "lucide-react";

import { Chip, MiniChip } from "@/components/admin/ui/Chip";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/DataTable";
import { Panel } from "@/components/admin/ui/Panel";
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
  icon: LucideIcon;
}

const CHANNEL_CARDS: ChannelMeta[] = [
  {
    channel: "ZALO_OA",
    name: "Zalo OA",
    chipLabel: "Kênh chính",
    tone: "ok",
    desc: "Kênh chính cho cảnh báo nội bộ: cần xuất vé, quá SLA, sắp hết hạn giữ chỗ.",
    icon: MessageSquare,
  },
  {
    channel: "ZNS",
    name: "ZNS",
    chipLabel: "Khách hàng",
    tone: "info",
    desc: "Tin chính thức gửi khách: xác nhận giữ chỗ, link thanh toán, vé điện tử, hoàn tiền.",
    icon: BellRing,
  },
  {
    channel: "TELEGRAM",
    name: "Telegram",
    chipLabel: "Dự phòng",
    tone: "warn",
    desc: "Dự phòng khi khẩn cấp — chỉ kích hoạt cho cảnh báo quá SLA / không xuất được.",
    icon: Send,
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

// NotificationJobStatus → nhãn + tone chip (Manager dùng chip trạng thái, không phải chữ màu).
function statusChip(row: NotifRow): { label: string; tone: Tone } {
  switch (row.status) {
    case "SENT":
      return { label: "Đã gửi", tone: "ok" };
    case "PENDING":
    case "PROCESSING":
      return { label: "Đang chờ", tone: "warn" };
    case "FAILED":
      return row.attempts > 0 && row.attempts < row.maxAttempts
        ? { label: `Thử lại (${row.attempts}/${row.maxAttempts})`, tone: "warn" }
        : { label: "Thất bại", tone: "red" };
    case "CANCELLED":
      return { label: "Đã huỷ", tone: "muted" };
    case "SKIPPED":
      return { label: "Bỏ qua", tone: "muted" };
    default:
      return { label: row.status, tone: "muted" };
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
      width: "72px",
      render: (row) => <span className="ofly-num text-[12.5px] text-[var(--ink2)]">{formatTime(row.createdAt)}</span>,
    },
    {
      key: "event",
      header: "SỰ KIỆN",
      width: "minmax(0,1.5fr)",
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-medium text-[var(--ink)]">{row.type}</div>
          {row.pnr || row.route ? (
            <div className="mt-[3px] flex items-center gap-[7px] truncate text-[11.5px] text-[var(--ink3)]">
              {row.pnr ? (
                <span className="ofly-mono text-[11px] font-medium tracking-[0.4px] text-[var(--ink2)]">{row.pnr}</span>
              ) : null}
              {row.pnr && row.route ? <span aria-hidden="true">·</span> : null}
              {row.route ? <span className="truncate">{formatRoute(row.route)}</span> : null}
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
        <span className="text-[12.5px] text-[var(--ink3)]">{CHANNEL_LABELS[row.channel] ?? row.channel}</span>
      ),
    },
    {
      key: "audience",
      header: "ĐỐI TƯỢNG",
      width: "104px",
      render: (row) =>
        row.audience === "CUSTOMER" ? <MiniChip tone="info">Khách</MiniChip> : <MiniChip tone="rust">Nội bộ</MiniChip>,
    },
    {
      key: "status",
      header: "TRẠNG THÁI",
      width: "148px",
      render: (row) => {
        const status = statusChip(row);
        return <Chip tone={status.tone}>{status.label}</Chip>;
      },
    },
  ];

  return (
    <div>
      <div className="mb-[18px] grid gap-3 md:grid-cols-3">
        {CHANNEL_CARDS.map((card) => {
          const t = toneVars(card.tone);
          const Icon = card.icon;
          return (
            // h-full + mt-auto: dòng "Hôm nay" của 3 thẻ nằm thẳng hàng dù mô tả dài ngắn khác nhau.
            <Panel key={card.channel} className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-[10px]">
                  <span
                    className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[8px] border"
                    style={{ background: t.bg, borderColor: t.bd, color: t.fg }}
                  >
                    <Icon size={16} strokeWidth={1.7} aria-hidden="true" />
                  </span>
                  <span className="ofly-serif truncate text-[19px] font-medium leading-[1.15] tracking-[-0.5px] text-[var(--ink)]">
                    {card.name}
                  </span>
                </div>
                <MiniChip tone={card.tone}>{card.chipLabel}</MiniChip>
              </div>

              <p className="m-0 mt-[11px] text-[12.5px] leading-[1.5] text-[var(--ink3)]">{card.desc}</p>

              <div className="mt-auto flex items-baseline gap-[7px] border-t border-[var(--line)] pt-[13px]">
                <span className="text-[12px] text-[var(--ink3)]">Hôm nay:</span>
                <span className="ofly-num text-[20px] font-bold leading-none text-[var(--ink)]">
                  {sentByChannel.get(card.channel) ?? 0}
                </span>
                <span className="text-[12px] text-[var(--ink3)]">tin</span>
              </div>
            </Panel>
          );
        })}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        empty="Chưa có thông báo nào được gửi."
      />
    </div>
  );
}
