import { RejectPaymentButton } from "@/components/admin/RejectPaymentButton";
import { Chip, MiniChip } from "@/components/admin/ui/Chip";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/DataTable";
import { SectionTitle } from "@/components/admin/ui/PageHead";
import { Eyebrow, Panel } from "@/components/admin/ui/Panel";
import { StatTile } from "@/components/admin/ui/Stat";
import type { PaymentSummary } from "@/lib/booking/paymentSummary";
import type { AdminBookingPayment } from "@/lib/bookings/admin";
import type { Tone } from "@/lib/admin/ui/tones";

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

// Tone theo bảng `--tone-*` để chip đọc được ở cả Ngày/Đêm (thay bộ class emerald/amber/rose cũ).
const PAYMENT_TONE: Record<AdminBookingPayment["status"], Tone> = {
  PENDING: "muted",
  PARTIAL: "warn",
  PAID: "ok",
  REJECTED: "red",
  REFUNDED: "info",
};

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
  const columns: DataTableColumn<AdminBookingPayment>[] = [
    {
      key: "method",
      header: "Method",
      width: "110px",
      render: (payment) => <span className="font-semibold text-[var(--ink)]">{payment.method}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      width: "minmax(0,1.1fr)",
      align: "right",
      render: (payment) => (
        <span className="ofly-num font-semibold text-[var(--ink)]">{formatCurrency(payment.amount, payment.currency)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "148px",
      render: (payment) => <Chip tone={PAYMENT_TONE[payment.status]}>{paymentStatusLabel(payment.status)}</Chip>,
    },
    {
      key: "paidAt",
      header: "Paid at",
      width: "minmax(0,1.1fr)",
      render: (payment) => <span className="ofly-num text-[12.5px]">{formatDateTime(payment.paidAt)}</span>,
    },
    {
      key: "transactionRef",
      header: "Transaction ref",
      width: "minmax(0,1fr)",
      render: (payment) => <span className="ofly-num text-[12.5px] text-[var(--ink3)]">{payment.transactionRef || "-"}</span>,
    },
    {
      key: "receivedBy",
      header: "Received by",
      width: "minmax(0,1.1fr)",
      render: (payment) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-[var(--ink)]">{payment.receivedBy?.fullName || "-"}</div>
          <div className="truncate text-[11.5px] text-[var(--ink3)]">{payment.receivedBy?.email || "-"}</div>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      width: "136px",
      align: "right",
      render: (payment) => (
        <div className="flex justify-end">
          {canRejectPayments ? (
            <RejectPaymentButton
              bookingId={bookingId}
              disabled={payment.status === "REJECTED" || payment.status === "REFUNDED"}
              paymentId={payment.id}
            />
          ) : (
            <MiniChip tone="muted">Read-only</MiniChip>
          )}
        </div>
      ),
    },
  ];

  return (
    <Panel padded={false} className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[var(--line)] bg-[var(--paper2)] px-[20px] py-[16px] lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Eyebrow>Sổ thanh toán</Eyebrow>
          <SectionTitle className="mt-[8px]">Thanh toán và đối soát</SectionTitle>
        </div>

        <Chip tone={paymentSummary.balance <= 0 ? "ok" : "warn"}>{paymentSummaryLabel(paymentSummary.balance)}</Chip>
      </div>

      <div className="px-[20px] py-[18px]">
        <div className="grid gap-3 md:grid-cols-3">
          <StatTile label="Tổng đã thu" value={formatCurrency(paymentSummary.totalPaid, currency)} tone="green" minWidth={0} />
          <StatTile label="Tổng phải thu" value={formatCurrency(paymentSummary.totalDue, currency)} minWidth={0} />
          <StatTile
            label="Công nợ"
            value={formatCurrency(paymentSummary.balance, currency)}
            tone={paymentSummary.balance <= 0 ? "plain" : "amber"}
            minWidth={0}
          />
        </div>

        <div className="mt-[18px] overflow-hidden rounded-[12px] border border-[var(--line)]">
          <DataTable
            columns={columns}
            rows={payments}
            getRowKey={(payment) => payment.id}
            framed={false}
            empty="Booking này chưa có payment record nào."
          />
        </div>
      </div>
    </Panel>
  );
}
