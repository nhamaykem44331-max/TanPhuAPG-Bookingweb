import { PriceAlertStatus } from "@prisma/client";

import { deletePriceAlertAction, togglePriceAlertStatusAction } from "@/app/admin/price-alerts/actions";
import type { PriceAlertRecord } from "@/lib/price-alerts/admin";

interface PriceAlertTableProps {
  alerts: PriceAlertRecord[];
  canManage: boolean;
}

function splitRoute(route: string): { from: string; to: string } {
  const [from = route, to = ""] = route.split("-");
  return { from, to };
}

function formatMoney(value: number): string {
  return `${value.toLocaleString("vi-VN")} ₫`;
}

function formatDateParts(value: string | null): { time: string; date: string } {
  if (!value) {
    return { time: "--:--", date: "Chưa có" };
  }

  const date = new Date(value);

  return {
    time: new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(date),
    date: new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "short",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(date),
  };
}

function statusClass(status: PriceAlertStatus): string {
  if (status === PriceAlertStatus.ACTIVE) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === PriceAlertStatus.TRIGGERED) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
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

function RouteChip({ route }: { route: string }) {
  const { from, to } = splitRoute(route);

  return (
    <div className="inline-flex items-center rounded-md border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 apg-mono text-xs font-bold tracking-[0.24em] text-cyan-200">
      {from}
      <span className="mx-2 tracking-normal text-cyan-500">→</span>
      {to}
    </div>
  );
}

export function PriceAlertTable({ alerts, canManage }: PriceAlertTableProps) {
  if (alerts.length === 0) {
    return (
      <div className="apg-admin-sheet p-8">
        <div className="mx-auto max-w-xl text-center">
          <h3 className="text-base font-semibold text-[var(--apg-text-primary)]">Chưa có alert phù hợp với bộ lọc</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--apg-text-secondary)]">
            Thử nới route, airline hoặc status để xem thêm kết quả.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="apg-admin-sheet overflow-hidden">
      <div className="hidden overflow-x-auto md:block">
        <table className="apg-admin-table min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Route</th>
              <th className="px-4 py-3 text-left font-semibold">Airline</th>
              <th className="px-4 py-3 text-left font-semibold">Target</th>
              <th className="px-4 py-3 text-left font-semibold">Direction</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Triggered</th>
              <th className="px-4 py-3 text-left font-semibold">Created by</th>
              <th className="px-4 py-3 text-left font-semibold">Created</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => {
              const createdAt = formatDateParts(alert.createdAt);
              const triggeredAt = formatDateParts(alert.triggeredAt);

              return (
                <tr key={alert.id} className="border-t border-[var(--apg-border-default)] align-middle">
                  <td className="px-4 py-3">
                    <RouteChip route={alert.route} />
                  </td>
                  <td className="px-4 py-3 font-semibold text-[var(--apg-text-primary)]">{alert.airline ?? "Tất cả"}</td>
                  <td className="px-4 py-3">
                    <div className="apg-tabular font-semibold text-[var(--apg-text-primary)]">{formatMoney(alert.targetPrice)}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--apg-text-secondary)]">{directionLabel(alert.direction)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(alert.status)}`}>
                      {statusLabel(alert.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="apg-tabular font-semibold text-[var(--apg-text-primary)]">{triggeredAt.time}</div>
                    <div className="mt-0.5 text-xs text-[var(--apg-text-muted)]">{triggeredAt.date}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--apg-text-primary)]">{alert.createdBy.fullName}</div>
                    <div className="mt-0.5 max-w-[220px] truncate text-xs text-[var(--apg-text-muted)]">{alert.createdBy.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="apg-tabular font-semibold text-[var(--apg-text-primary)]">{createdAt.time}</div>
                    <div className="mt-0.5 text-xs text-[var(--apg-text-muted)]">{createdAt.date}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {canManage ? (
                        <>
                          <form action={togglePriceAlertStatusAction}>
                            <input type="hidden" name="id" value={alert.id} />
                            <input type="hidden" name="status" value={nextStatus(alert.status)} />
                            <button className="apg-btn-secondary h-8 px-3 text-xs" type="submit">
                              {alert.status === PriceAlertStatus.ACTIVE ? "Tắt" : "Bật lại"}
                            </button>
                          </form>
                          <form action={deletePriceAlertAction}>
                            <input type="hidden" name="id" value={alert.id} />
                            <button className="apg-btn-danger h-8 px-3 text-xs" type="submit">
                              Xóa mềm
                            </button>
                          </form>
                        </>
                      ) : (
                        <span className="rounded-full border border-[var(--apg-border-default)] px-3 py-1 text-xs text-[var(--apg-text-muted)]">
                          Read-only
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-3 md:hidden">
        {alerts.map((alert) => {
          const createdAt = formatDateParts(alert.createdAt);

          return (
            <article key={alert.id} className="rounded-lg border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] p-4">
              <div className="flex items-start justify-between gap-3">
                <RouteChip route={alert.route} />
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(alert.status)}`}>
                  {statusLabel(alert.status)}
                </span>
              </div>
              <div className="mt-4 grid gap-3 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-[var(--apg-text-muted)]">Target</div>
                  <div className="apg-tabular mt-1 font-semibold text-[var(--apg-text-primary)]">{formatMoney(alert.targetPrice)}</div>
                </div>
                <div className="text-[var(--apg-text-secondary)]">
                  {alert.airline ?? "Tất cả hãng"} · {directionLabel(alert.direction)} · {createdAt.date}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
