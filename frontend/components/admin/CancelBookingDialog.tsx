"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { Btn } from "@/components/admin/ui/Btn";
import { Field, Input, Select, Textarea } from "@/components/admin/ui/Field";
import { Eyebrow } from "@/components/admin/ui/Panel";
import { StatTile } from "@/components/admin/ui/Stat";
import { toneVars } from "@/lib/admin/ui/tones";

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
      <Btn variant="danger" full disabled={disabled} onClick={() => setOpen(true)}>
        Hủy booking
      </Btn>

      {disabled && disabledReason ? <p className="mt-2 text-[12px] leading-[1.5] text-[var(--ink3)]">{disabledReason}</p> : null}

      {open ? (
        // Modal theo Manager (`kit.tsx` → Modal): overlay mờ + blur, hộp bo 14px, tiêu đề Fraunces.
        <div
          className="ofly-overlay-in fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(20,17,16,0.52)", backdropFilter: "blur(2px)" }}
        >
          <div
            aria-modal="true"
            role="dialog"
            className="ofly-modal-in max-h-[90vh] w-full max-w-[720px] overflow-y-auto rounded-[14px] border border-[var(--line2)] bg-[var(--paper)]"
            style={{ boxShadow: "0 30px 80px -30px rgba(20,17,16,0.55)" }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-[24px] pb-[16px] pt-[22px]">
              <div className="min-w-0">
                <Eyebrow className="mb-2">Hủy đơn</Eyebrow>
                <h3 className="ofly-serif m-0 text-[23px] font-medium leading-[1.2] tracking-[-0.6px] text-[var(--ink)]">
                  Xác nhận hủy booking
                </h3>
                <p className="m-0 mt-[10px] max-w-[560px] text-[13px] leading-[1.55] text-[var(--ink3)]">
                  Hệ thống sẽ chuyển booking sang trạng thái CANCELLED, ghi timeline và có thể tạo payment âm nếu anh chọn hoàn tiền.
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[8px] border border-[var(--line2)] bg-transparent text-[var(--ink2)] transition-colors duration-150 hover:bg-[var(--paper2)] disabled:opacity-60"
                disabled={isPending}
                onClick={() => setOpen(false)}
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            <div className="grid gap-5 px-[24px] py-[20px] lg:grid-cols-[minmax(0,1.2fr)_260px]">
              <div className="flex flex-col gap-4">
                <StatTile label="Trạng thái hiện tại" value={status} minWidth={0} />

                <Field label="Lý do hủy">
                  <Select
                    disabled={isPending}
                    onChange={(event) => setReason(event.target.value as CancelReason)}
                    value={reason}
                  >
                    {REASON_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Chi tiết">
                  <Textarea
                    className="min-h-[120px]"
                    disabled={isPending}
                    maxLength={1000}
                    onChange={(event) => setDetail(event.target.value)}
                    placeholder={reason === "OTHER" ? "Bắt buộc tối thiểu 10 ký tự khi chọn lý do khác." : "Ghi chú nội bộ nếu cần."}
                    value={detail}
                  />
                </Field>

                {canMarkRefund ? (
                  <div className="rounded-[12px] border border-[var(--line)] bg-[var(--paper2)] px-[16px] py-[14px]">
                    <label className="flex items-start gap-3 text-[13.5px] font-semibold text-[var(--ink)]">
                      <input
                        checked={markRefund}
                        className="mt-[3px] h-[15px] w-[15px] flex-none accent-[var(--rust)]"
                        disabled={isPending}
                        onChange={(event) => setMarkRefund(event.target.checked)}
                        type="checkbox"
                      />
                      <span>
                        Đánh dấu refund
                        <span className="mt-1 block text-[12.5px] font-normal leading-[1.5] text-[var(--ink3)]">
                          Tổng đã thu hiện tại: {formatCurrency(totalPaid, currency)}. Refund sẽ tạo payment âm.
                        </span>
                      </span>
                    </label>

                    {markRefund ? (
                      <div className="mt-4">
                        <Field label={`Số tiền hoàn (${currency})`}>
                          <Input
                            disabled={isPending}
                            inputMode="numeric"
                            max={totalPaid}
                            mono
                            onChange={(event) => setRefundAmount(event.target.value)}
                            placeholder={`Tối đa ${formatMoney(totalPaid)}`}
                            step={1000}
                            type="number"
                            value={refundAmount}
                          />
                        </Field>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <aside className="flex flex-col gap-3">
                <div className="rounded-[12px] border border-[var(--line)] bg-[var(--paper)] px-[16px] py-[14px]">
                  <Eyebrow>Checklist nhanh</Eyebrow>
                  <ul className="mt-3 flex list-none flex-col gap-2 p-0 text-[12.5px] leading-[1.5] text-[var(--ink2)]">
                    <li>Chỉ hủy khi đã xác nhận trạng thái với đội vận hành.</li>
                    <li>Refund chỉ nên bật cho booking TICKETED có payment PAID.</li>
                    <li>Lý do OTHER cần mô tả cụ thể để tra soát sau.</li>
                  </ul>
                </div>

                <StatTile label="Tổng đã thu" value={formatMoney(totalPaid)} sub={currency} tone="navy" minWidth={0} />
                <p className="m-0 text-[12px] leading-[1.5] text-[var(--ink3)]">
                  {currency} đang có thể tham chiếu khi hoàn tiền.
                </p>
              </aside>
            </div>

            {message ? (
              <div
                className="mx-[24px] mb-[4px] rounded-[10px] border px-[13px] py-[10px] text-[12.5px] font-medium leading-[1.45]"
                style={{ color: toneVars("red").fg, background: toneVars("red").bg, borderColor: toneVars("red").bd }}
                role="alert"
              >
                {message}
              </div>
            ) : null}

            <div className="mt-[16px] flex flex-wrap justify-end gap-[10px] border-t border-[var(--line)] px-[24px] py-[16px]">
              <Btn variant="ghost" disabled={isPending} onClick={() => setOpen(false)}>
                Đóng
              </Btn>
              <Btn variant="danger" disabled={isPending} onClick={handleSubmit}>
                {isPending ? "Đang hủy..." : "Xác nhận hủy"}
              </Btn>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
