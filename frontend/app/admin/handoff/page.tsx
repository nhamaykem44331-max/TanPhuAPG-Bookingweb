import { RefreshCw, Send } from "lucide-react";

import { Btn } from "@/components/admin/ui/Btn";
import { Chip } from "@/components/admin/ui/Chip";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/DataTable";
import { Panel } from "@/components/admin/ui/Panel";
import { formatRoute, formatVnd } from "@/lib/admin/ui/format";
import type { Tone } from "@/lib/admin/ui/tones";
import { RMS_HANDOFF_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface HandoffRow {
  id: string;
  pnr: string | null;
  route: string;
  net: number;
  markup: number;
  sale: number;
  refunded: boolean;
  synced: boolean;
}

// Cột RMS: hoàn tiền chờ ghi → plum; đã xuất + đã đồng bộ → ok; đã xuất chưa ghi → warn.
function rmsChip(row: HandoffRow): { label: string; tone: Tone } {
  if (row.refunded) return { label: "Hoàn — chờ ghi", tone: "plum" };
  return row.synced ? { label: "Đã đồng bộ", tone: "ok" } : { label: "Chờ ghi RMS", tone: "warn" };
}

export default async function AdminHandoffPage() {
  await requireRole(RMS_HANDOFF_ROLES);

  const bookings = await prisma.booking.findMany({
    where: { status: { in: ["TICKETED", "REFUNDED"] } },
    orderBy: { updatedAt: "desc" },
    take: 60,
    select: {
      id: true,
      pnr: true,
      routeSummary: true,
      netAmount: true,
      saleAmount: true,
      markupAmount: true,
      status: true,
      rmsSyncedAt: true,
    },
  });

  const rows: HandoffRow[] = bookings.map((booking) => ({
    id: booking.id,
    pnr: booking.pnr,
    route: booking.routeSummary,
    net: booking.netAmount,
    markup: booking.markupAmount,
    sale: booking.saleAmount,
    refunded: booking.status === "REFUNDED",
    synced: booking.rmsSyncedAt !== null,
  }));

  const columns: DataTableColumn<HandoffRow>[] = [
    {
      key: "pnr",
      header: "PNR",
      width: "104px",
      // PNR là mã → mono theo quy ước Manager.
      render: (row) => (
        <span className="ofly-num text-[13px] font-semibold text-[var(--rust)]">{row.pnr ?? "—"}</span>
      ),
    },
    {
      key: "route",
      header: "CHẶNG",
      width: "minmax(0,1.2fr)",
      // Chặng là mã sân bay → mono giãn chữ như Route của Manager; serif chỉ dành cho tiêu đề.
      render: (row) => (
        <span className="ofly-num text-[13.5px] font-medium tracking-[0.5px] text-[var(--ink)]">
          {formatRoute(row.route)}
        </span>
      ),
    },
    {
      key: "net",
      header: "NET",
      width: "132px",
      align: "right",
      render: (row) => <span className="ofly-num text-[13px] text-[var(--ink2)]">{formatVnd(row.net)}</span>,
    },
    {
      key: "markup",
      header: "MARKUP",
      width: "124px",
      align: "right",
      render: (row) => (
        <span className="ofly-num text-[13px] font-semibold text-[var(--rust)]">+{formatVnd(row.markup)}</span>
      ),
    },
    {
      key: "sale",
      header: "KHÁCH TRẢ",
      width: "142px",
      align: "right",
      // Số tiền khách trả là cột chốt của bảng → mono đậm màu --ink.
      render: (row) => (
        <span className="ofly-num text-[14px] font-bold text-[var(--ink)]">{formatVnd(row.sale)}</span>
      ),
    },
    {
      key: "rms",
      header: "RMS",
      width: "152px",
      render: (row) => {
        const chip = rmsChip(row);
        return <Chip tone={chip.tone}>{chip.label}</Chip>;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <Panel className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className="mt-[1px] flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[8px] bg-[var(--rustTint)] text-[var(--rust)]"
            aria-hidden="true"
          >
            <Send size={17} strokeWidth={1.5} />
          </span>
          <p className="max-w-[520px] text-[13.5px] leading-[1.6] text-[var(--ink2)]">
            Đơn đã xuất vé được bàn giao sang <strong className="font-semibold text-[var(--ink)]">RMS</strong> để hạch
            toán net/giá bán/markup. Trang web chỉ giữ vai trò vận hành kênh bán.
          </p>
        </div>
        {/* Bọc div để nút full-width trên mobile (44px vùng bấm) nhưng co lại theo chữ từ sm trở lên */}
        <div className="w-full shrink-0 sm:w-auto">
          <Btn variant="rust" full icon={<RefreshCw size={16} strokeWidth={1.5} aria-hidden="true" />}>
            Đồng bộ sang RMS
          </Btn>
        </div>
      </Panel>

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        empty="Chưa có đơn nào cần bàn giao sang RMS."
      />
    </div>
  );
}
