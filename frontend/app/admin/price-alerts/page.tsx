import { PriceAlertStatus } from "@prisma/client";
import { Plus } from "lucide-react";

import { PriceAlertTable } from "@/components/admin/PriceAlertTable";
import { Btn, ButtonLink } from "@/components/admin/ui/Btn";
import { Field, Input, Select } from "@/components/admin/ui/Field";
import { Panel } from "@/components/admin/ui/Panel";
import { StatCard, StatTile } from "@/components/admin/ui/Stat";
import { formatNumber } from "@/lib/admin/ui/format";
import { toneVars } from "@/lib/admin/ui/tones";
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

  // ButtonLink chỉ nhận href dạng chuỗi → dựng sẵn query string cho 2 nút phân trang.
  function pageHref(offset: number): string {
    const params = new URLSearchParams(baseQuery as Record<string, string>);
    params.set("offset", String(offset));
    return `/admin/price-alerts?${params.toString()}`;
  }

  return (
    <div>
      {/* Topbar của AdminShell đã đóng vai PageHead (eyebrow + h1) → đây chỉ là dòng mô tả + hành động. */}
      <div className="mb-[22px] flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <p className="max-w-[520px] text-[14px] leading-[1.6] text-[var(--ink3)]">
          Theo dõi ngưỡng giá theo chặng bay, trigger AuditLog và gửi cảnh báo nội bộ.
        </p>
        <div className="flex flex-wrap items-center gap-[10px]">
          <StatTile label="Tổng" value={formatNumber(result.total)} sub="alert" />
          {canManage ? (
            <ButtonLink
              href="/admin/price-alerts/new"
              variant="rust"
              icon={<Plus size={16} strokeWidth={1.9} />}
            >
              Tạo alert
            </ButtonLink>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard
          label="Active"
          value={<span style={{ color: "var(--green)" }}>{activeCount}</span>}
          sub={statusLabel(PriceAlertStatus.ACTIVE)}
        />
        <StatCard
          label="Triggered"
          value={<span style={{ color: "var(--amber)" }}>{triggeredCount}</span>}
          sub={statusLabel(PriceAlertStatus.TRIGGERED)}
        />
        <StatCard
          label="Disabled"
          value={<span style={{ color: "var(--ink3)" }}>{disabledCount}</span>}
          sub={statusLabel(PriceAlertStatus.DISABLED)}
        />
      </div>

      {/* Banner kết quả lấy màu từ biến tone (giống /admin/markup) → tự đúng ở cả giao diện Ngày và Đêm. */}
      {statusMessage ? (
        <div
          className="mt-3 rounded-[10px] border px-[16px] py-[11px] text-[13px] font-medium"
          style={{
            color: toneVars("ok").fg,
            background: toneVars("ok").bg,
            borderColor: toneVars("ok").bd,
          }}
        >
          {statusMessage}
        </div>
      ) : null}

      <Panel className="mt-3">
        <form className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_180px_180px_120px_auto_auto] xl:items-end">
          <Field label="Route">
            <Input mono defaultValue={query.q ?? ""} name="q" placeholder="SGN-HAN" />
          </Field>

          <Field label="Airline">
            <Input mono defaultValue={query.airline ?? ""} name="airline" placeholder="VJ" />
          </Field>

          <Field label="Status">
            <Select
              defaultValue={query.status ?? ""}
              name="status"
              options={[
                { value: "", label: "Tất cả" },
                { value: PriceAlertStatus.ACTIVE, label: statusLabel(PriceAlertStatus.ACTIVE) },
                { value: PriceAlertStatus.TRIGGERED, label: statusLabel(PriceAlertStatus.TRIGGERED) },
                { value: PriceAlertStatus.DISABLED, label: statusLabel(PriceAlertStatus.DISABLED) },
              ]}
            />
          </Field>

          <Field label="Limit">
            <Input mono defaultValue={String(query.limit)} min={1} max={100} name="limit" type="number" />
          </Field>

          <input name="offset" type="hidden" value="0" />
          <Btn type="submit" variant="primary" full>
            Lọc alert
          </Btn>

          <ButtonLink href="/admin/price-alerts" variant="ghost" full>
            Xóa lọc
          </ButtonLink>
        </form>
      </Panel>

      <div className="mt-3">
        <PriceAlertTable alerts={result.items} canManage={canManage} />
      </div>

      {/* Pager để trần như các màn khác (audit/bookings/payments) — không bọc Panel. */}
      <div className="mt-[14px] flex flex-wrap items-center justify-between gap-3">
        <ButtonLink
          href={pageHref(previousOffset)}
          variant="ghost"
          size="sm"
          className={query.offset === 0 ? "pointer-events-none opacity-40" : ""}
        >
          Trang trước
        </ButtonLink>
        <div className="text-[12.5px] text-[var(--ink3)]">
          Hiển thị <span className="ofly-num text-[var(--ink)]">{formatNumber(result.items.length)}</span> /{" "}
          <span className="ofly-num text-[var(--ink)]">{formatNumber(result.total)}</span> alert
        </div>
        <ButtonLink
          href={pageHref(nextOffset)}
          variant="ghost"
          size="sm"
          className={!hasNextPage ? "pointer-events-none opacity-40" : ""}
        >
          Trang sau
        </ButtonLink>
      </div>
    </div>
  );
}
