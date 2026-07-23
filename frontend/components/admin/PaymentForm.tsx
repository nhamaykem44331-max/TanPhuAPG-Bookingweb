"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { Btn } from "@/components/admin/ui/Btn";
import { Field, Input, Select, Textarea } from "@/components/admin/ui/Field";
import { SectionTitle } from "@/components/admin/ui/PageHead";
import { Eyebrow, Panel } from "@/components/admin/ui/Panel";
import { StatTile } from "@/components/admin/ui/Stat";
import { formatNumber, formatVnd } from "@/lib/admin/ui/format";

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

// Tiền VND đi qua helper chung của admin (nhóm nghìn bằng dấu chấm); ngoại tệ giữ
// nguyên cách ghi mã tiền tệ phía sau như trước.
function formatCurrency(value: number, currency: string | null | undefined = "VND"): string {
  return currency === "VND" || !currency ? formatVnd(value) : `${formatNumber(value)} ${currency}`;
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
    // id giữ nguyên trên <section> vì đang là mỏ neo điều hướng (#payment-capture).
    <section id="payment-capture">
      <Panel>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_300px]">
          <div>
            <Eyebrow>Payment Capture</Eyebrow>
            <SectionTitle className="mt-[10px]">Ghi nhận thanh toán thủ công</SectionTitle>
            <p className="mt-[10px] max-w-[580px] text-[13.5px] leading-[1.6] text-[var(--ink3)]">
              Dùng khu vực này để nhập chứng từ thanh toán, lưu transaction reference và chốt công nợ còn lại. Hệ thống sẽ tự phân loại
              payment thành <span className="font-semibold text-[var(--ink)]">PARTIAL</span> hoặc{" "}
              <span className="font-semibold text-[var(--ink)]">PAID</span> theo số dư hiện tại.
            </p>

            <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 lg:grid-cols-2">
                <Field label="Phương thức" error={fieldErrors.method?.[0]}>
                  <Select
                    disabled={isPending}
                    error={Boolean(fieldErrors.method?.[0])}
                    name="method"
                    onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                    options={PAYMENT_METHOD_OPTIONS}
                    value={method}
                  />
                </Field>

                <Field label={`Số tiền (${currency})`} error={fieldErrors.amount?.[0]}>
                  <Input
                    disabled={isPending}
                    error={Boolean(fieldErrors.amount?.[0])}
                    inputMode="numeric"
                    mono
                    name="amount"
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder={`Tối đa ${formatNumber(balance)}`}
                    type="number"
                    value={amount}
                  />
                </Field>

                <Field label="Mã giao dịch" error={fieldErrors.transactionRef?.[0]}>
                  <Input
                    disabled={isPending}
                    error={Boolean(fieldErrors.transactionRef?.[0])}
                    mono
                    name="transactionRef"
                    onChange={(event) => setTransactionRef(event.target.value)}
                    placeholder="Ví dụ: BIDV-20260423-001"
                    type="text"
                    value={transactionRef}
                  />
                </Field>

                <Field label="Thời gian thanh toán" error={fieldErrors.paidAt?.[0]}>
                  <Input
                    disabled={isPending}
                    error={Boolean(fieldErrors.paidAt?.[0])}
                    name="paidAt"
                    onChange={(event) => setPaidAt(event.target.value)}
                    type="datetime-local"
                    value={paidAt}
                  />
                </Field>

                <Field className="lg:col-span-2" label="URL chứng từ" error={fieldErrors.proofUrl?.[0]}>
                  <Input
                    disabled={isPending}
                    error={Boolean(fieldErrors.proofUrl?.[0])}
                    name="proofUrl"
                    onChange={(event) => setProofUrl(event.target.value)}
                    placeholder="https://..."
                    type="url"
                    value={proofUrl}
                  />
                </Field>

                <Field className="lg:col-span-2" label="Ghi chú" error={fieldErrors.notes?.[0]}>
                  <Textarea
                    className="min-h-[120px]"
                    disabled={isPending}
                    error={Boolean(fieldErrors.notes?.[0])}
                    name="notes"
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Ghi chú nội bộ khi cần đối soát."
                    rows={5}
                    value={notes}
                  />
                </Field>
              </div>

              {formState.message ? (
                <div
                  className="rounded-[10px] border px-[14px] py-[11px] text-[13px] font-medium text-[var(--red)]"
                  style={{
                    background: "color-mix(in srgb, var(--red) 7%, transparent)",
                    borderColor: "color-mix(in srgb, var(--red) 26%, transparent)",
                  }}
                >
                  {formState.message}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Btn disabled={isPending} type="submit" variant="rust">
                  {isPending ? "Đang ghi nhận..." : "Ghi nhận thanh toán"}
                </Btn>
                <p className="text-[12.5px] text-[var(--ink3)]">
                  Sau khi lưu xong, trang sẽ tự làm mới để cập nhật bảng thanh toán và số dư.
                </p>
              </div>
            </form>
          </div>

          <aside className="flex flex-col gap-[12px]">
            {/* Công nợ còn lại = việc phải soát tay → tone amber theo quy ước màn thanh toán */}
            <StatTile
              label="Công nợ hiện tại"
              minWidth={0}
              tone="amber"
              value={formatCurrency(balance, currency)}
            />
            <p className="text-[12.5px] leading-[1.6] text-[var(--ink3)]">
              {currency} cần đối soát thêm trước khi issue.
            </p>

            <Panel className="mt-[2px]">
              <Eyebrow>Checklist nhanh</Eyebrow>
              <ul className="mt-3 space-y-2 text-[12.5px] leading-[1.6] text-[var(--ink3)]">
                <li>Ưu tiên lưu `transactionRef` để tra soát sau.</li>
                <li>Chỉ nhập số tiền nhỏ hơn hoặc bằng balance hiện tại.</li>
                <li>Refund sẽ đi theo flow hủy booking, không nhập ở đây.</li>
              </ul>
            </Panel>
          </aside>
        </div>
      </Panel>
    </section>
  );
}
