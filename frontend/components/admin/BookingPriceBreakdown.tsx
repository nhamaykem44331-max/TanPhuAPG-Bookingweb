import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { MiniChip } from "@/components/admin/ui/Chip";
import { SectionTitle } from "@/components/admin/ui/PageHead";
import { Eyebrow, Panel } from "@/components/admin/ui/Panel";
import { StatTile } from "@/components/admin/ui/Stat";
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
    <Panel padded={false} className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[var(--line)] bg-[var(--paper2)] px-[20px] py-[16px] lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Eyebrow>Ảnh chụp thương mại</Eyebrow>
          <SectionTitle className="mt-[8px]">Cấu trúc giá và rule đã áp</SectionTitle>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MiniChip tone="muted">Kênh {booking.channel}</MiniChip>
          <MiniChip tone="muted">Nguồn {booking.source}</MiniChip>
        </div>
      </div>

      <div className="grid gap-3 px-[20px] py-[18px] lg:grid-cols-[minmax(0,1.45fr)_340px]">
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <StatTile label="Giá net" value={formatCurrency(booking.netAmount, booking.currency)} minWidth={0} />
            <StatTile label="Markup" value={formatCurrency(booking.markupAmount, booking.currency)} tone="rust" minWidth={0} />
            <StatTile label="Phí dịch vụ" value={formatCurrency(booking.serviceFeeAmount, booking.currency)} minWidth={0} />
            <StatTile label="Giá bán" value={formatCurrency(booking.saleAmount, booking.currency)} tone="navy" minWidth={0} />
            <StatTile
              label="Lợi nhuận"
              value={formatCurrency(booking.profit, booking.currency)}
              tone={booking.profit < 0 ? "red" : "green"}
              minWidth={0}
            />
          </div>

          <div className="rounded-[12px] border border-[var(--line)] bg-[var(--paper2)] px-[18px] py-[16px]">
            <Eyebrow>Snapshot</Eyebrow>
            <SectionTitle className="mt-[8px]">Rule markup áp cho booking này</SectionTitle>

            {appliedMarkupRule ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <StatTile label="Scope" value={appliedMarkupRule.scope} minWidth={0} />
                <StatTile
                  label="Loại rule"
                  value={`${appliedMarkupRule.markupType} · ${formatMarkupValue(appliedMarkupRule)}`}
                  minWidth={0}
                />
                <StatTile label="Service fee" value={formatCurrency(Number(appliedMarkupRule.serviceFee))} minWidth={0} />
                <div className="flex flex-col justify-center rounded-[10px] border border-[var(--line)] bg-[var(--paper)] px-[16px] py-[10px]">
                  <span className="text-[10px] font-semibold uppercase leading-none tracking-[1px] text-[var(--ink3)]">
                    Điều hướng
                  </span>
                  <Link
                    className="mt-[6px] inline-flex items-center gap-[6px] text-[13px] font-semibold text-[var(--rust)] transition-colors duration-150 hover:text-[var(--rustLt)]"
                    href={`/admin/markup-rules/${appliedMarkupRule.id}/edit`}
                  >
                    Mở rule để chỉnh sửa
                    <ArrowUpRight size={14} strokeWidth={1.5} />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="ofly-serif mt-4 rounded-[10px] border border-dashed border-[var(--line2)] bg-[var(--paper)] px-4 py-[38px] text-center text-[16px] italic leading-[1.5] text-[var(--ink3)]">
                Booking này không giữ liên kết tới một markup rule riêng. Hệ thống đang hiển thị snapshot giá đã khóa tại thời điểm xử lý.
              </div>
            )}
          </div>
        </div>

        <aside className="rounded-[12px] border border-[var(--line)] bg-[var(--paper)] px-[18px] py-[16px]">
          <Eyebrow>Applied snapshot JSON</Eyebrow>
          <p className="m-0 mt-3 text-[12.5px] leading-[1.55] text-[var(--ink3)]">
            Payload này giúp đội vận hành kiểm tra lại rule, mức cộng giá và service fee đúng tại thời điểm booking được ghi nhận.
          </p>
          <pre className="ofly-mono mt-4 max-h-[420px] overflow-auto rounded-[10px] border border-[var(--line)] bg-[var(--paper2)] p-[14px] text-[11.5px] leading-[1.7] text-[var(--ink2)]">
            {stringifyJson(booking.appliedMarkupRuleSnapshot)}
          </pre>
        </aside>
      </div>
    </Panel>
  );
}
