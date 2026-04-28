import type { ReactNode } from "react";

import type { PaymentSummary } from "@/lib/booking/paymentSummary";
import type { AdminBookingCore } from "@/lib/bookings/admin";

interface BookingDetailHeaderProps {
  booking: AdminBookingCore;
  paymentSummary: PaymentSummary;
  paymentFormEnabled: boolean;
  accessBadge?: string;
  issueAction?: ReactNode;
  cancelAction?: ReactNode;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatCurrency(value: number, currency: string | null | undefined = "VND"): string {
  return currency === "VND" || !currency ? `${formatMoney(value)} ₫` : `${formatMoney(value)} ${currency}`;
}

function formatDateTime(value: Date | null): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(value);
}

function statusClassName(status: string): string {
  if (status === "TICKETED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "HELD") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "CANCELLED" || status === "FAILED" || status === "EXPIRED") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] text-[var(--apg-text-secondary)]";
}

export function BookingDetailHeader({
  booking,
  paymentSummary,
  paymentFormEnabled,
  accessBadge,
  issueAction,
  cancelAction,
}: BookingDetailHeaderProps) {
  const balanceText =
    paymentSummary.balance <= 0 ? "Đã đủ tiền" : `Còn thiếu ${formatCurrency(paymentSummary.balance, booking.currency)}`;

  return (
    <section className="apg-admin-sheet overflow-hidden">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1.55fr)_380px]">
        <div className="px-5 py-6 lg:px-6">
          <p className="apg-eyebrow">Booking Detail</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--apg-aviation-navy-deep)] text-sm font-semibold tracking-[0.08em] text-white shadow-sm">
              {(booking.airline || "PN").slice(0, 2)}
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-[var(--apg-aviation-navy-deep)]">{booking.orderCode}</h2>
              <p className="mt-1 text-sm text-[var(--apg-text-secondary)]">Booking ID: {booking.id} · PNR chính: {booking.pnr || "PENDING"}</p>
            </div>
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${statusClassName(booking.status)}`}>
              {booking.status}
            </span>
            {accessBadge ? (
              <span className="inline-flex items-center rounded-full border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] px-3 py-1 text-sm font-semibold text-[var(--apg-text-secondary)]">
                {accessBadge}
              </span>
            ) : null}
          </div>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--apg-text-secondary)]">
            Từ màn này anh có thể kiểm tra trạng thái booking, tình hình thu tiền, timeline tác nghiệp và các dữ liệu snapshot đã lưu khi
            hold hoặc issue.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="apg-admin-stat px-4 py-4">
              <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Hành trình</div>
              <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{booking.routeSummary}</div>
            </div>

            <div className="apg-admin-stat px-4 py-4">
              <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Ngày tạo</div>
              <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{formatDateTime(booking.createdAt)}</div>
            </div>

            <div className="apg-admin-stat px-4 py-4">
              <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Đã thu</div>
              <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">
                {formatCurrency(paymentSummary.totalPaid, booking.currency)}
              </div>
            </div>

            <div className="apg-admin-stat px-4 py-4">
              <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Công nợ</div>
              <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{balanceText}</div>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--apg-border-default)] bg-[linear-gradient(180deg,rgba(233,238,242,0.95),rgba(255,255,255,0.98))] px-5 py-5 xl:border-l xl:border-t-0">
          <div className="space-y-3">
            <div className="apg-admin-stat px-4 py-4">
              <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Tác vụ chính</div>
              <div className="mt-3 flex flex-col gap-3">
                {paymentFormEnabled ? (
                  <a className="apg-btn-secondary block w-full text-center" href="#payment-qr">
                    Mở QR & payment
                  </a>
                ) : (
                  <button className="apg-btn-secondary w-full opacity-60" disabled type="button">
                    Ghi nhận thanh toán
                  </button>
                )}
                {issueAction ?? (
                  <button className="apg-btn-secondary w-full opacity-60" disabled type="button">
                    Xuất vé
                  </button>
                )}
                {cancelAction ?? (
                  <button className="apg-btn-secondary w-full opacity-60" disabled type="button">
                    Hủy booking
                  </button>
                )}
              </div>
            </div>

            <div className="apg-admin-stat px-4 py-4">
              <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Tóm tắt nghiệp vụ</div>
              <div className="mt-3 space-y-2 text-sm text-[var(--apg-text-secondary)]">
                <div>Kênh: <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">{booking.channel}</span></div>
                <div>Nguồn: <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">{booking.source}</span></div>
                <div>Trạng thái hiện tại: <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">{booking.status}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
