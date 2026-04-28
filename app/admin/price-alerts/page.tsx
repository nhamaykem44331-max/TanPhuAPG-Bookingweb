import { PriceAlertStatus } from "@prisma/client";
import Link from "next/link";

import { PriceAlertTable } from "@/components/admin/PriceAlertTable";
import { ADMIN_ROLES, PRICE_ALERT_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { listPriceAlerts } from "@/lib/price-alerts/admin";
import { priceAlertListQuerySchema } from "@/lib/price-alerts/schemas";

interface PriceAlertsPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

function singleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getStatusMessage(searchParams: PriceAlertsPageProps["searchParams"]): string | null {
  if (searchParams?.created === "1") return "Đã tạo price alert mới.";
  if (searchParams?.toggled === "1") return "Đã cập nhật trạng thái price alert.";
  if (searchParams?.deleted === "1") return "Đã xóa mềm price alert.";
  return null;
}

function statusLabel(status: PriceAlertStatus): string {
  if (status === PriceAlertStatus.ACTIVE) return "Đang bật";
  if (status === PriceAlertStatus.TRIGGERED) return "Đã trigger";
  return "Đã tắt";
}

export default async function PriceAlertsPage({ searchParams }: PriceAlertsPageProps) {
  const session = await requireRole(ADMIN_ROLES);
  const query = priceAlertListQuerySchema.parse({
    q: singleValue(searchParams?.q),
    status: singleValue(searchParams?.status),
    airline: singleValue(searchParams?.airline),
    limit: singleValue(searchParams?.limit),
    offset: singleValue(searchParams?.offset),
  });
  const result = await listPriceAlerts(query);
  const canManage = PRICE_ALERT_MANAGER_ROLES.includes(session.user.role);
  const previousOffset = Math.max(query.offset - query.limit, 0);
  const nextOffset = query.offset + query.limit;
  const hasNextPage = nextOffset < result.total;
  const statusMessage = getStatusMessage(searchParams);
  const activeCount = result.items.filter((item) => item.status === PriceAlertStatus.ACTIVE).length;
  const triggeredCount = result.items.filter((item) => item.status === PriceAlertStatus.TRIGGERED).length;
  const disabledCount = result.items.filter((item) => item.status === PriceAlertStatus.DISABLED).length;
  const baseQuery = Object.fromEntries(
    Object.entries({
      q: query.q,
      status: query.status,
      airline: query.airline,
      limit: String(query.limit),
    }).filter((entry) => entry[1]),
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-base font-semibold text-[var(--apg-text-primary)]">Price Alerts</h1>
          <p className="mt-1 text-sm text-[var(--apg-text-secondary)]">
            Theo dõi ngưỡng giá theo chặng bay, trigger AuditLog và gửi cảnh báo nội bộ.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-3 py-2 text-sm text-[var(--apg-text-secondary)]">
            Tổng: {result.total} alert
          </span>
          {canManage ? (
            <Link className="apg-btn-primary inline-flex items-center justify-center px-4" href="/admin/price-alerts/new">
              + Tạo alert
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="apg-admin-stat px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--apg-text-muted)]">Active</div>
          <div className="apg-tabular mt-3 text-3xl font-semibold text-lime-300">{activeCount}</div>
        </div>
        <div className="apg-admin-stat px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--apg-text-muted)]">Triggered</div>
          <div className="apg-tabular mt-3 text-3xl font-semibold text-amber-300">{triggeredCount}</div>
        </div>
        <div className="apg-admin-stat px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--apg-text-muted)]">Disabled</div>
          <div className="apg-tabular mt-3 text-3xl font-semibold text-rose-300">{disabledCount}</div>
        </div>
      </div>

      {statusMessage ? (
        <div className="rounded-lg border border-[color:rgba(0,208,132,0.24)] bg-[color:rgba(0,208,132,0.1)] px-4 py-3 text-sm font-medium text-[#27e79b]">
          {statusMessage}
        </div>
      ) : null}

      <div className="apg-admin-toolbar px-4 py-4">
        <form className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_180px_180px_120px_auto_auto] xl:items-end">
          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Route
            <input className="apg-field mt-2" defaultValue={query.q ?? ""} name="q" placeholder="SGN-HAN" />
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Airline
            <input className="apg-field mt-2" defaultValue={query.airline ?? ""} name="airline" placeholder="VJ" />
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Status
            <select className="apg-field mt-2" defaultValue={query.status ?? ""} name="status">
              <option value="">Tất cả</option>
              <option value={PriceAlertStatus.ACTIVE}>{statusLabel(PriceAlertStatus.ACTIVE)}</option>
              <option value={PriceAlertStatus.TRIGGERED}>{statusLabel(PriceAlertStatus.TRIGGERED)}</option>
              <option value={PriceAlertStatus.DISABLED}>{statusLabel(PriceAlertStatus.DISABLED)}</option>
            </select>
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Limit
            <input className="apg-field mt-2" defaultValue={String(query.limit)} min={1} max={100} name="limit" type="number" />
          </label>

          <div className="flex items-end">
            <input name="offset" type="hidden" value="0" />
            <button className="apg-btn-primary w-full" type="submit">
              Lọc alert
            </button>
          </div>

          <div className="flex items-end">
            <Link className="apg-btn-secondary inline-flex w-full items-center justify-center" href="/admin/price-alerts">
              Xóa lọc
            </Link>
          </div>
        </form>
      </div>

      <PriceAlertTable alerts={result.items} canManage={canManage} />

      <div className="flex items-center justify-between rounded-lg border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-4 py-3">
        <Link
          className={`apg-btn-secondary ${query.offset === 0 ? "pointer-events-none opacity-50" : ""}`}
          href={{ pathname: "/admin/price-alerts", query: { ...baseQuery, offset: String(previousOffset) } }}
        >
          Trang trước
        </Link>
        <div className="text-sm text-[var(--apg-text-secondary)]">
          Hiển thị {result.items.length} / {result.total} alert
        </div>
        <Link
          className={`apg-btn-secondary ${!hasNextPage ? "pointer-events-none opacity-50" : ""}`}
          href={{ pathname: "/admin/price-alerts", query: { ...baseQuery, offset: String(nextOffset) } }}
        >
          Trang sau
        </Link>
      </div>
    </section>
  );
}
