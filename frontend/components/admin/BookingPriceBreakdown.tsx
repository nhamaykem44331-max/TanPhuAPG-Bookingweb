import Link from "next/link";

import type { AdminAppliedMarkupRule, AdminBookingCore } from "@/lib/bookings/admin";

interface BookingPriceBreakdownProps {
  booking: AdminBookingCore;
  appliedMarkupRule: AdminAppliedMarkupRule;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatCurrency(value: number, currency: string | null | undefined = "VND"): string {
  return currency === "VND" || !currency ? `${formatMoney(value)} ₫` : `${formatMoney(value)} ${currency}`;
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function formatMarkupValue(rule: NonNullable<AdminAppliedMarkupRule>): string {
  if (rule.markupType === "PERCENT") {
    return `${rule.markupValue.toString()}%`;
  }

  return formatCurrency(Number(rule.markupValue));
}

export function BookingPriceBreakdown({ booking, appliedMarkupRule }: BookingPriceBreakdownProps) {
  return (
    <section className="apg-admin-sheet overflow-hidden">
      <div className="border-b border-[var(--apg-border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(238,242,245,0.98))] px-5 py-4 lg:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="apg-eyebrow">Commercial Snapshot</p>
            <h3 className="mt-2 text-2xl font-semibold text-[var(--apg-aviation-navy-deep)]">Cấu trúc giá và rule đã áp</h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--apg-text-secondary)]">
            <span className="apg-chip">Kênh {booking.channel}</span>
            <span className="apg-chip">Nguồn {booking.source}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1.45fr)_360px] lg:p-6">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <article className="apg-admin-stat px-4 py-4">
              <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Giá net</div>
              <div className="mt-2 apg-tabular text-lg font-semibold text-[var(--apg-aviation-navy-deep)]">
                {formatCurrency(booking.netAmount, booking.currency)}
              </div>
            </article>

            <article className="apg-admin-stat px-4 py-4">
              <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Markup</div>
              <div className="mt-2 apg-tabular text-lg font-semibold text-[var(--apg-aviation-navy-deep)]">
                {formatCurrency(booking.markupAmount, booking.currency)}
              </div>
            </article>

            <article className="apg-admin-stat px-4 py-4">
              <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Phí dịch vụ</div>
              <div className="mt-2 apg-tabular text-lg font-semibold text-[var(--apg-aviation-navy-deep)]">
                {formatCurrency(booking.serviceFeeAmount, booking.currency)}
              </div>
            </article>

            <article className="apg-admin-stat px-4 py-4">
              <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Giá bán</div>
              <div className="mt-2 apg-tabular text-lg font-semibold text-[var(--apg-aviation-navy-deep)]">
                {formatCurrency(booking.saleAmount, booking.currency)}
              </div>
            </article>

            <article className="apg-admin-stat px-4 py-4">
              <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Lợi nhuận</div>
              <div className="mt-2 apg-tabular text-lg font-semibold text-[var(--apg-aviation-navy-deep)]">
                {formatCurrency(booking.profit, booking.currency)}
              </div>
            </article>
          </div>

          <div className="apg-admin-toolbar px-5 py-5">
            <p className="apg-eyebrow">Snapshot</p>
            <h4 className="mt-2 text-xl font-semibold text-[var(--apg-aviation-navy-deep)]">Rule markup áp cho booking này</h4>

            {appliedMarkupRule ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="apg-admin-stat px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Scope</div>
                  <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{appliedMarkupRule.scope}</div>
                </div>
                <div className="apg-admin-stat px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Loại rule</div>
                  <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">
                    {appliedMarkupRule.markupType} · {formatMarkupValue(appliedMarkupRule)}
                  </div>
                </div>
                <div className="apg-admin-stat px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Service fee</div>
                  <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">
                    {formatCurrency(Number(appliedMarkupRule.serviceFee))}
                  </div>
                </div>
                <div className="apg-admin-stat px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Điều hướng</div>
                  <Link
                    className="mt-2 inline-flex text-base font-semibold text-[var(--apg-aviation-navy)] hover:underline"
                    href={`/admin/markup-rules/${appliedMarkupRule.id}/edit`}
                  >
                    Mở rule để chỉnh sửa
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-[20px] border border-dashed border-[var(--apg-border-default)] bg-white px-4 py-8 text-center text-sm text-[var(--apg-text-secondary)]">
                Booking này không giữ liên kết tới một markup rule riêng. Hệ thống đang hiển thị snapshot giá đã khóa tại thời điểm xử lý.
              </div>
            )}
          </div>
        </div>

        <aside className="apg-admin-stat px-4 py-4">
          <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Applied snapshot JSON</div>
          <p className="mt-3 text-sm leading-6 text-[var(--apg-text-secondary)]">
            Payload này giúp đội vận hành kiểm tra lại rule, mức cộng giá và service fee đúng tại thời điểm booking được ghi nhận.
          </p>
          <pre className="mt-4 max-h-[420px] overflow-auto rounded-[18px] bg-[var(--apg-aviation-navy-deep)]/95 p-4 text-xs leading-6 text-slate-50">
            {stringifyJson(booking.appliedMarkupRuleSnapshot)}
          </pre>
        </aside>
      </div>
    </section>
  );
}
