import { RejectPaymentButton } from "@/components/admin/RejectPaymentButton";
import type { PaymentSummary } from "@/lib/booking/paymentSummary";
import type { AdminBookingPayment } from "@/lib/bookings/admin";

interface BookingPaymentsTableProps {
  bookingId: string;
  payments: AdminBookingPayment[];
  paymentSummary: PaymentSummary;
  currency: string;
  canRejectPayments: boolean;
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

function paymentSummaryLabel(balance: number): string {
  if (balance <= 0) {
    return "Đã đủ tiền";
  }

  return `Còn thiếu ${formatMoney(balance)}`;
}

function paymentStatusClass(status: AdminBookingPayment["status"]): string {
  if (status === "PAID") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "PARTIAL") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "REJECTED") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (status === "REFUNDED") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] text-[var(--apg-text-secondary)]";
}

function paymentStatusLabel(status: AdminBookingPayment["status"]): string {
  const labels: Record<AdminBookingPayment["status"], string> = {
    PENDING: "Chờ xử lý",
    PARTIAL: "Thu một phần",
    PAID: "Đã thu đủ",
    REJECTED: "Đã từ chối",
    REFUNDED: "Hoàn tiền",
  };

  return labels[status];
}

export function BookingPaymentsTable({
  bookingId,
  payments,
  paymentSummary,
  currency,
  canRejectPayments,
}: BookingPaymentsTableProps) {
  return (
    <section className="apg-admin-sheet overflow-hidden">
      <div className="border-b border-[var(--apg-border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(238,242,245,0.98))] px-5 py-4 lg:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="apg-eyebrow">Payment Ledger</p>
            <h3 className="mt-2 text-2xl font-semibold text-[var(--apg-aviation-navy-deep)]">Thanh toán và đối soát</h3>
          </div>

          <div
            className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${
              paymentSummary.balance <= 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {paymentSummaryLabel(paymentSummary.balance)}
          </div>
        </div>
      </div>

      <div className="p-5 lg:p-6">
        <div className="grid gap-3 md:grid-cols-3">
          <article className="apg-admin-stat px-4 py-4">
            <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Tổng đã thu</div>
            <div className="mt-2 apg-tabular text-lg font-semibold text-[var(--apg-aviation-navy-deep)]">
              {formatCurrency(paymentSummary.totalPaid, currency)}
            </div>
          </article>
          <article className="apg-admin-stat px-4 py-4">
            <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Tổng phải thu</div>
            <div className="mt-2 apg-tabular text-lg font-semibold text-[var(--apg-aviation-navy-deep)]">
              {formatCurrency(paymentSummary.totalDue, currency)}
            </div>
          </article>
          <article className="apg-admin-stat px-4 py-4">
            <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Công nợ</div>
            <div className="mt-2 apg-tabular text-lg font-semibold text-[var(--apg-aviation-navy-deep)]">
              {formatCurrency(paymentSummary.balance, currency)}
            </div>
          </article>
        </div>

        {payments.length === 0 ? (
          <div className="mt-5 rounded-[20px] border border-dashed border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-4 py-10 text-center text-sm text-[var(--apg-text-secondary)]">
            Booking này chưa có payment record nào.
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-4 md:hidden">
              {payments.map((payment) => (
                <article key={payment.id} className="rounded-[22px] border border-[var(--apg-border-default)] bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-[var(--apg-text-secondary)]">{payment.method}</div>
                      <div className="mt-2 apg-tabular text-lg font-semibold text-[var(--apg-aviation-navy-deep)]">
                        {formatCurrency(payment.amount, payment.currency)}
                      </div>
                    </div>

                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${paymentStatusClass(payment.status)}`}>
                      {paymentStatusLabel(payment.status)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-[var(--apg-text-secondary)]">
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em]">Paid at</div>
                      <div className="mt-1 text-[var(--apg-aviation-navy-deep)]">{formatDateTime(payment.paidAt)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em]">Transaction ref</div>
                      <div className="mt-1 text-[var(--apg-aviation-navy-deep)]">{payment.transactionRef || "-"}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-xs uppercase tracking-[0.16em]">Received by</div>
                      <div className="mt-1 text-[var(--apg-aviation-navy-deep)]">{payment.receivedBy?.fullName || payment.receivedBy?.email || "-"}</div>
                    </div>
                  </div>

                  {canRejectPayments ? (
                    <div className="mt-4">
                      <RejectPaymentButton
                        bookingId={bookingId}
                        disabled={payment.status === "REJECTED" || payment.status === "REFUNDED"}
                        paymentId={payment.id}
                      />
                    </div>
                  ) : null}
                </article>
              ))}
            </div>

            <div className="mt-5 hidden overflow-x-auto md:block">
              <table className="apg-admin-table min-w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="px-5 py-4 font-semibold">Method</th>
                    <th className="px-4 py-4 font-semibold">Amount</th>
                    <th className="px-4 py-4 font-semibold">Status</th>
                    <th className="px-4 py-4 font-semibold">Paid at</th>
                    <th className="px-4 py-4 font-semibold">Transaction ref</th>
                    <th className="px-4 py-4 font-semibold">Received by</th>
                    <th className="px-5 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-t border-[var(--apg-border-default)] align-top">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-[var(--apg-aviation-navy-deep)]">{payment.method}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="apg-tabular text-base font-semibold text-[var(--apg-aviation-navy-deep)]">
                          {formatCurrency(payment.amount, payment.currency)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${paymentStatusClass(payment.status)}`}>
                          {paymentStatusLabel(payment.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-[var(--apg-aviation-navy-deep)]">{formatDateTime(payment.paidAt)}</td>
                      <td className="px-4 py-4 text-[var(--apg-text-secondary)]">{payment.transactionRef || "-"}</td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-[var(--apg-aviation-navy-deep)]">{payment.receivedBy?.fullName || "-"}</div>
                        <div className="mt-1 text-xs text-[var(--apg-text-secondary)]">{payment.receivedBy?.email || "-"}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end">
                          {canRejectPayments ? (
                            <RejectPaymentButton
                              bookingId={bookingId}
                              disabled={payment.status === "REJECTED" || payment.status === "REFUNDED"}
                              paymentId={payment.id}
                            />
                          ) : (
                            <span className="rounded-full border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] px-3 py-2 text-xs text-[var(--apg-text-secondary)]">
                              Read-only
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
