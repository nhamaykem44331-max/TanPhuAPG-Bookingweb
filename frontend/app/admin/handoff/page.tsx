import { MiniChip } from "@/components/admin/ui/Chip";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/DataTable";
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
      width: "100px",
      render: (row) => (
        <span className="ofly-sans text-[13px] font-semibold tracking-[1px] text-[var(--rust)]">{row.pnr ?? "—"}</span>
      ),
    },
    {
      key: "route",
      header: "CHẶNG",
      width: "minmax(0,1.2fr)",
      render: (row) => <span className="ofly-serif text-[15px] font-medium">{formatRoute(row.route)}</span>,
    },
    {
      key: "net",
      header: "NET",
      width: "130px",
      render: (row) => <span className="text-[13px]">{formatVnd(row.net)}</span>,
    },
    {
      key: "markup",
      header: "MARKUP",
      width: "120px",
      render: (row) => <span className="text-[13px] text-[var(--rust)]">+{formatVnd(row.markup)}</span>,
    },
    {
      key: "sale",
      header: "KHÁCH TRẢ",
      width: "130px",
      render: (row) => <span className="ofly-serif text-[15px] font-medium">{formatVnd(row.sale)}</span>,
    },
    {
      key: "rms",
      header: "RMS",
      width: "130px",
      render: (row) => {
        const chip = rmsChip(row);
        return <MiniChip tone={chip.tone}>{chip.label}</MiniChip>;
      },
    },
  ];

  return (
    <div>
      <div className="mb-[22px] flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <p className="max-w-[520px] text-[14px] leading-[1.6] text-[var(--ink-soft)]">
          Đơn đã xuất vé được bàn giao sang <strong className="font-semibold text-[var(--ink)]">RMS</strong> để hạch
          toán net/giá bán/markup. Trang web chỉ giữ vai trò vận hành kênh bán.
        </p>
        <button
          type="button"
          className="w-full shrink-0 rounded-[8px] border border-[var(--rust)] bg-[var(--rust)] px-[18px] py-[11px] text-[13px] font-semibold text-[#F5F1EA] sm:w-auto"
        >
          Đồng bộ sang RMS
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        empty="Chưa có đơn nào cần bàn giao sang RMS."
        className="overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]"
      />
    </div>
  );
}
