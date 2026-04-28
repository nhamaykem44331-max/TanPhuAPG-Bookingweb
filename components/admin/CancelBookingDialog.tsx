"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

type CancelReason = "CUSTOMER_REQUEST" | "PAYMENT_FAIL" | "AIRLINE_CANCEL" | "DUPLICATE" | "OTHER";

interface CancelBookingDialogProps {
  bookingId: string;
  status: string;
  currency: string;
  totalPaid: number;
  canMarkRefund: boolean;
  disabled: boolean;
  disabledReason: string | null;
}

const REASON_OPTIONS: Array<{ value: CancelReason; label: string }> = [
  { value: "CUSTOMER_REQUEST", label: "Khách yêu cầu" },
  { value: "PAYMENT_FAIL", label: "Thanh toán thất bại" },
  { value: "AIRLINE_CANCEL", label: "Hãng hủy chuyến" },
  { value: "DUPLICATE", label: "Booking trùng" },
  { value: "OTHER", label: "Lý do khác" },
];

function formatMoney(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatCurrency(value: number, currency: string | null | undefined = "VND"): string {
  return currency === "VND" || !currency ? `${formatMoney(value)} ₫` : `${formatMoney(value)} ${currency}`;
}

export function CancelBookingDialog({
  bookingId,
  status,
  currency,
  totalPaid,
  canMarkRefund,
  disabled,
  disabledReason,
}: CancelBookingDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [reason, setReason] = useState<CancelReason>("CUSTOMER_REQUEST");
  const [detail, setDetail] = useState("");
  const [markRefund, setMarkRefund] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit() {
    setIsPending(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason,
          detail,
          markRefund,
          refundAmount: markRefund ? refundAmount : undefined,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            message?: string;
            fieldErrors?: Record<string, string[] | undefined>;
          }
        | null;

      if (!response.ok) {
        const detailError = payload?.fieldErrors?.detail?.[0];
        const refundError = payload?.fieldErrors?.refundAmount?.[0];
        setMessage(detailError || refundError || payload?.message || payload?.error || "Không thể hủy booking.");
        return;
      }

      setOpen(false);
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setMessage("Kết nối tới API hủy booking bị gián đoạn, vui lòng thử lại.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <button
        className={`w-full rounded-[var(--apg-radius-md)] px-4 py-2 text-sm font-semibold transition ${
          disabled
            ? "cursor-not-allowed border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] text-[var(--apg-text-secondary)] opacity-70"
            : "border border-rose-300 bg-rose-600 text-white hover:bg-rose-700"
        }`}
        disabled={disabled}
        onClick={() => setOpen(true)}
        type="button"
      >
        Hủy booking
      </button>

      {disabled && disabledReason ? <p className="text-xs leading-5 text-[var(--apg-text-secondary)]">{disabledReason}</p> : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-8">
          <div className="apg-admin-toolbar max-h-[90vh] w-full max-w-3xl overflow-y-auto px-5 py-5 lg:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="apg-eyebrow">Cancel Booking</p>
                <h3 className="mt-2 text-2xl font-semibold text-[var(--apg-aviation-navy-deep)]">Xác nhận hủy booking</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--apg-text-secondary)]">
                  Hệ thống sẽ chuyển booking sang trạng thái CANCELLED, ghi timeline và có thể tạo payment âm nếu anh chọn hoàn tiền.
                </p>
              </div>
              <button className="apg-btn-secondary" disabled={isPending} onClick={() => setOpen(false)} type="button">
                Đóng
              </button>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_320px]">
              <div className="space-y-5">
                <div className="apg-admin-stat px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Trạng thái hiện tại</div>
                  <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{status}</div>
                </div>

                <label className="block">
                  <span className="apg-field-label">Lý do hủy</span>
                  <select
                    className="apg-field mt-2"
                    disabled={isPending}
                    onChange={(event) => setReason(event.target.value as CancelReason)}
                    value={reason}
                  >
                    {REASON_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="apg-field-label">Chi tiết</span>
                  <textarea
                    className="apg-field mt-2 h-auto min-h-[120px] py-3"
                    disabled={isPending}
                    maxLength={1000}
                    onChange={(event) => setDetail(event.target.value)}
                    placeholder={reason === "OTHER" ? "Bắt buộc tối thiểu 10 ký tự khi chọn lý do khác." : "Ghi chú nội bộ nếu cần."}
                    value={detail}
                  />
                </label>

                {canMarkRefund ? (
                  <div className="apg-admin-sheet px-4 py-4">
                    <label className="flex items-start gap-3 text-sm font-medium text-[var(--apg-aviation-navy-deep)]">
                      <input
                        checked={markRefund}
                        className="mt-1"
                        disabled={isPending}
                        onChange={(event) => setMarkRefund(event.target.checked)}
                        type="checkbox"
                      />
                      <span>
                        Đánh dấu refund
                        <span className="mt-1 block text-sm font-normal text-[var(--apg-text-secondary)]">
                          Tổng đã thu hiện tại: {formatCurrency(totalPaid, currency)}. Refund sẽ tạo payment âm.
                        </span>
                      </span>
                    </label>

                    {markRefund ? (
                      <label className="mt-4 block">
                        <span className="apg-field-label">Số tiền hoàn ({currency})</span>
                        <input
                          className="apg-field mt-2"
                          disabled={isPending}
                          inputMode="numeric"
                          max={totalPaid}
                          onChange={(event) => setRefundAmount(event.target.value)}
                          placeholder={`Tối đa ${formatMoney(totalPaid)}`}
                          step={1000}
                          type="number"
                          value={refundAmount}
                        />
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <aside className="space-y-3">
                <div className="apg-admin-stat px-4 py-4">
                  <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Checklist nhanh</div>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--apg-text-secondary)]">
                    <li>Chỉ hủy khi đã xác nhận trạng thái với đội vận hành.</li>
                    <li>Refund chỉ nên bật cho booking TICKETED có payment PAID.</li>
                    <li>Lý do OTHER cần mô tả cụ thể để tra soát sau.</li>
                  </ul>
                </div>

                <div className="apg-admin-stat px-4 py-4">
                  <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Tổng đã thu</div>
                  <div className="mt-3 apg-tabular text-3xl font-semibold text-[var(--apg-aviation-navy-deep)]">
                    {formatMoney(totalPaid)}
                  </div>
                  <div className="mt-1 text-sm text-[var(--apg-text-secondary)]">{currency} đang có thể tham chiếu khi hoàn tiền.</div>
                </div>
              </aside>
            </div>

            {message ? (
              <div className="mt-5 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {message}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button className="apg-btn-secondary" disabled={isPending} onClick={() => setOpen(false)} type="button">
                Đóng
              </button>
              <button
                className="rounded-[var(--apg-radius-md)] bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isPending}
                onClick={handleSubmit}
                type="button"
              >
                {isPending ? "Đang hủy..." : "Xác nhận hủy"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
