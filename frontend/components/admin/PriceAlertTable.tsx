import { PriceAlertStatus } from "@prisma/client";

import { deletePriceAlertAction, togglePriceAlertStatusAction } from "@/app/admin/price-alerts/actions";
import { Btn } from "@/components/admin/ui/Btn";
import { Chip, MiniChip } from "@/components/admin/ui/Chip";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/DataTable";
import { formatDate, formatRoute, formatTime, formatVnd } from "@/lib/admin/ui/format";
import type { Tone } from "@/lib/admin/ui/tones";
import type { PriceAlertRecord } from "@/lib/price-alerts/admin";

interface PriceAlertTableProps {
  alerts: PriceAlertRecord[];
  canManage: boolean;
}

function statusTone(status: PriceAlertStatus): Tone {
  if (status === PriceAlertStatus.ACTIVE) return "ok";
  if (status === PriceAlertStatus.TRIGGERED) return "warn";
  return "muted";
}

function statusLabel(status: PriceAlertStatus): string {
  if (status === PriceAlertStatus.ACTIVE) return "Đang bật";
  if (status === PriceAlertStatus.TRIGGERED) return "Đã trigger";
  return "Đã tắt";
}

function nextStatus(status: PriceAlertStatus): PriceAlertStatus {
  return status === PriceAlertStatus.ACTIVE ? PriceAlertStatus.DISABLED : PriceAlertStatus.ACTIVE;
}

function directionLabel(status: PriceAlertRecord["direction"]): string {
  return status === "BELOW" ? "≤ target" : "≥ target";
}

// Chặng là mã sân bay → mono, khung nhẹ giống CopyCode của Manager.
function RouteChip({ route }: { route: string }) {
  return (
    <span className="ofly-num inline-flex items-center rounded-[6px] border border-[var(--line2)] px-[9px] py-[4px] text-[12.5px] font-medium tracking-[0.5px] text-[var(--ink)]">
      {formatRoute(route)}
    </span>
  );
}

// Giờ trên, ngày dưới — cùng nhịp với các bảng admin khác.
function Stamp({ value }: { value: string | null }) {
  if (!value) {
    return <span className="text-[13px] text-[var(--ink4)]">Chưa có</span>;
  }

  return (
    <div>
      <div className="ofly-num text-[13px] font-medium text-[var(--ink)]">{formatTime(value)}</div>
      <div className="mt-[2px] text-[11.5px] text-[var(--ink4)]">{formatDate(value)}</div>
    </div>
  );
}

export function PriceAlertTable({ alerts, canManage }: PriceAlertTableProps) {
  const columns: DataTableColumn<PriceAlertRecord>[] = [
    {
      key: "route",
      header: "Route",
      width: "150px",
      render: (alert) => <RouteChip route={alert.route} />,
    },
    {
      key: "airline",
      header: "Airline",
      width: "96px",
      render: (alert) => (
        <span className="text-[13px] font-semibold text-[var(--ink)]">{alert.airline ?? "Tất cả"}</span>
      ),
    },
    {
      key: "target",
      header: "Target",
      width: "140px",
      render: (alert) => (
        <span className="ofly-num text-[13px] font-semibold text-[var(--ink)]">{formatVnd(alert.targetPrice)}</span>
      ),
    },
    {
      key: "direction",
      header: "Direction",
      width: "104px",
      render: (alert) => <span className="ofly-num text-[12.5px]">{directionLabel(alert.direction)}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "126px",
      render: (alert) => <Chip tone={statusTone(alert.status)}>{statusLabel(alert.status)}</Chip>,
    },
    {
      key: "triggered",
      header: "Triggered",
      width: "104px",
      render: (alert) => <Stamp value={alert.triggeredAt} />,
    },
    {
      key: "createdBy",
      header: "Created by",
      width: "minmax(0,1fr)",
      hideOnMobileCard: true,
      render: (alert) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-[var(--ink)]">{alert.createdBy.fullName}</div>
          <div className="mt-[2px] truncate text-[11.5px] text-[var(--ink4)]">{alert.createdBy.email}</div>
        </div>
      ),
    },
    {
      key: "created",
      header: "Created",
      width: "104px",
      render: (alert) => <Stamp value={alert.createdAt} />,
    },
    {
      key: "actions",
      header: "Actions",
      width: "176px",
      align: "right",
      render: (alert) =>
        canManage ? (
          <div className="flex flex-wrap justify-end gap-2">
            <form action={togglePriceAlertStatusAction}>
              <input type="hidden" name="id" value={alert.id} />
              <input type="hidden" name="status" value={nextStatus(alert.status)} />
              <Btn type="submit" variant="ghost" size="sm">
                {alert.status === PriceAlertStatus.ACTIVE ? "Tắt" : "Bật lại"}
              </Btn>
            </form>
            <form action={deletePriceAlertAction}>
              <input type="hidden" name="id" value={alert.id} />
              <Btn type="submit" variant="danger" size="sm">
                Xóa mềm
              </Btn>
            </form>
          </div>
        ) : (
          <div className="flex justify-end">
            <MiniChip tone="muted">Read-only</MiniChip>
          </div>
        ),
    },
  ];

  // 9 cột không vừa bề ngang màn hẹp → khung viền đứng ngoài, phần lưới cuộn ngang
  // (đúng cấu trúc DataTable của Manager). Dưới lg DataTable đã tự đổi sang thẻ dọc nên bỏ min-width.
  return (
    <div className="overflow-hidden rounded-[12px] border border-[var(--line)] bg-[var(--paper)]">
      <div className="overflow-x-auto">
        <div className="lg:min-w-[1160px]">
          <DataTable
            framed={false}
            columns={columns}
            rows={alerts}
            getRowKey={(alert) => alert.id}
            empty={
              <>
                <div>Chưa có alert phù hợp với bộ lọc</div>
                <div className="ofly-sans mt-2 text-[13px] not-italic text-[var(--ink3)]">
                  Thử nới route, airline hoặc status để xem thêm kết quả.
                </div>
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}
