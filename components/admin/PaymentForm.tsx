"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

type PaymentMethod = "CASH" | "BANK" | "QR" | "CARD" | "CREDIT";

interface PaymentFormProps {
  bookingId: string;
  currency: string;
  balance: number;
}

interface PaymentFormState {
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatCurrency(value: number, currency: string | null | undefined = "VND"): string {
  return currency === "VND" || !currency ? `${formatMoney(value)} ₫` : `${formatMoney(value)} ${currency}`;
}

function toDateTimeLocalValue(date: Date): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "CASH", label: "Tiền mặt" },
  { value: "BANK", label: "Chuyển khoản" },
  { value: "QR", label: "QR" },
  { value: "CARD", label: "Thẻ" },
  { value: "CREDIT", label: "Công nợ" },
];

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-1 text-xs font-medium text-rose-600">{message}</p>;
}

export function PaymentForm({ bookingId, currency, balance }: PaymentFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("BANK");
  const [amount, setAmount] = useState<string>(String(balance));
  const [transactionRef, setTransactionRef] = useState("");
  const [paidAt, setPaidAt] = useState(toDateTimeLocalValue(new Date()));
  const [proofUrl, setProofUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [formState, setFormState] = useState<PaymentFormState>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setFormState({});

    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method,
          amount,
          transactionRef,
          paidAt: paidAt ? new Date(paidAt).toISOString() : undefined,
          proofUrl,
          notes,
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
        setFormState({
          message: payload?.message || "Không thể ghi nhận thanh toán cho booking này.",
          fieldErrors: payload?.fieldErrors,
        });
        return;
      }

      setMethod("BANK");
      setAmount("");
      setTransactionRef("");
      setPaidAt(toDateTimeLocalValue(new Date()));
      setProofUrl("");
      setNotes("");
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setFormState({
        message: "Kết nối đến API thanh toán bị gián đoạn, vui lòng thử lại.",
      });
    } finally {
      setIsPending(false);
    }
  }

  const fieldErrors = formState.fieldErrors ?? {};

  return (
    <section className="apg-admin-toolbar px-5 py-5 lg:px-6" id="payment-capture">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_320px]">
        <div>
          <p className="apg-eyebrow">Payment Capture</p>
          <h3 className="mt-2 text-2xl font-semibold text-[var(--apg-aviation-navy-deep)]">Ghi nhận thanh toán thủ công</h3>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--apg-text-secondary)]">
            Dùng khu vực này để nhập chứng từ thanh toán, lưu transaction reference và chốt công nợ còn lại. Hệ thống sẽ tự phân loại
            payment thành <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">PARTIAL</span> hoặc{" "}
            <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">PAID</span> theo số dư hiện tại.
          </p>

          <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="apg-field-label">Phương thức</span>
                <select
                  className="apg-field mt-2"
                  disabled={isPending}
                  name="method"
                  onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                  value={method}
                >
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <FieldError message={fieldErrors.method?.[0]} />
              </label>

              <label className="block">
                <span className="apg-field-label">Số tiền ({currency})</span>
                <input
                  className="apg-field mt-2"
                  disabled={isPending}
                  inputMode="numeric"
                  name="amount"
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder={`Tối đa ${formatMoney(balance)}`}
                  type="number"
                  value={amount}
                />
                <FieldError message={fieldErrors.amount?.[0]} />
              </label>

              <label className="block">
                <span className="apg-field-label">Mã giao dịch</span>
                <input
                  className="apg-field mt-2"
                  disabled={isPending}
                  name="transactionRef"
                  onChange={(event) => setTransactionRef(event.target.value)}
                  placeholder="Ví dụ: BIDV-20260423-001"
                  type="text"
                  value={transactionRef}
                />
                <FieldError message={fieldErrors.transactionRef?.[0]} />
              </label>

              <label className="block">
                <span className="apg-field-label">Thời gian thanh toán</span>
                <input
                  className="apg-field mt-2"
                  disabled={isPending}
                  name="paidAt"
                  onChange={(event) => setPaidAt(event.target.value)}
                  type="datetime-local"
                  value={paidAt}
                />
                <FieldError message={fieldErrors.paidAt?.[0]} />
              </label>

              <label className="block lg:col-span-2">
                <span className="apg-field-label">URL chứng từ</span>
                <input
                  className="apg-field mt-2"
                  disabled={isPending}
                  name="proofUrl"
                  onChange={(event) => setProofUrl(event.target.value)}
                  placeholder="https://..."
                  type="url"
                  value={proofUrl}
                />
                <FieldError message={fieldErrors.proofUrl?.[0]} />
              </label>

              <label className="block lg:col-span-2">
                <span className="apg-field-label">Ghi chú</span>
                <textarea
                  className="apg-field mt-2 h-auto min-h-[120px] py-3"
                  disabled={isPending}
                  name="notes"
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Ghi chú nội bộ khi cần đối soát."
                  value={notes}
                />
                <FieldError message={fieldErrors.notes?.[0]} />
              </label>
            </div>

            {formState.message ? (
              <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {formState.message}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button className="apg-btn-primary" disabled={isPending} type="submit">
                {isPending ? "Đang ghi nhận..." : "Ghi nhận thanh toán"}
              </button>
              <p className="text-sm text-[var(--apg-text-secondary)]">
                Sau khi lưu xong, trang sẽ tự làm mới để cập nhật bảng thanh toán và số dư.
              </p>
            </div>
          </form>
        </div>

        <aside className="space-y-3">
          <div className="apg-admin-stat px-4 py-4">
            <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Công nợ hiện tại</div>
            <div className="mt-3 apg-tabular text-3xl font-semibold text-[var(--apg-aviation-navy-deep)]">
              {formatCurrency(balance, currency)}
            </div>
            <div className="mt-1 text-sm text-[var(--apg-text-secondary)]">{currency} cần đối soát thêm trước khi issue.</div>
          </div>

          <div className="apg-admin-stat px-4 py-4">
            <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Checklist nhanh</div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--apg-text-secondary)]">
              <li>Ưu tiên lưu `transactionRef` để tra soát sau.</li>
              <li>Chỉ nhập số tiền nhỏ hơn hoặc bằng balance hiện tại.</li>
              <li>Refund sẽ đi theo flow hủy booking, không nhập ở đây.</li>
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}
