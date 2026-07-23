import type { ReactNode } from "react";

import { Btn, ButtonLink } from "@/components/admin/ui/Btn";
import { MiniChip, StatusChip } from "@/components/admin/ui/Chip";
import { Panel, Eyebrow } from "@/components/admin/ui/Panel";
import { StatTile } from "@/components/admin/ui/Stat";
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

// Dòng "nhãn · giá trị" trong khối tóm tắt nghiệp vụ.
function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] py-[8px] last:border-b-0">
      <span className="text-[12.5px] text-[var(--ink3)]">{label}</span>
      <span className="text-[13px] font-semibold text-[var(--ink)]">{value}</span>
    </div>
  );
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
    <Panel padded={false} className="overflow-hidden">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1.55fr)_360px]">
        <div className="px-[24px] py-[22px]">
          <Eyebrow>Chi tiết đơn</Eyebrow>

          <div className="mt-[14px] flex flex-wrap items-center gap-3">
            {/* Ô mã hãng: khối navy đặc — chữ trắng là ngoại lệ hex duy nhất được phép (§1). */}
            <div
              className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-[10px] text-[14px] font-bold tracking-[0.5px]"
              style={{ background: "var(--gradNavy)", color: "#FFFFFF" }}
            >
              {(booking.airline || "PN").slice(0, 2)}
            </div>
            <div className="min-w-0">
              <h2 className="ofly-serif m-0 text-[30px] font-medium leading-none tracking-[-1.2px] text-[var(--ink)]">
                <span className="ofly-num">{booking.orderCode}</span>
              </h2>
              <p className="m-0 mt-[8px] text-[12.5px] text-[var(--ink3)]">
                Booking ID: <span className="ofly-num">{booking.id}</span> · PNR chính:{" "}
                <span className="ofly-num text-[var(--rust)]">{booking.pnr || "PENDING"}</span>
              </p>
            </div>
            <StatusChip status={booking.status} />
            {accessBadge ? <MiniChip tone="muted">{accessBadge}</MiniChip> : null}
          </div>

          <p className="m-0 mt-[14px] max-w-[620px] text-[13px] leading-[1.6] text-[var(--ink3)]">
            Từ màn này anh có thể kiểm tra trạng thái booking, tình hình thu tiền, timeline tác nghiệp và các dữ liệu snapshot đã lưu khi
            hold hoặc issue.
          </p>

          <div className="mt-[18px] grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Hành trình" value={booking.routeSummary} minWidth={0} />
            <StatTile label="Ngày tạo" value={formatDateTime(booking.createdAt)} minWidth={0} />
            <StatTile label="Đã thu" value={formatCurrency(paymentSummary.totalPaid, booking.currency)} tone="green" minWidth={0} />
            <StatTile
              label="Công nợ"
              value={balanceText}
              tone={paymentSummary.balance <= 0 ? "plain" : "amber"}
              minWidth={0}
            />
          </div>
        </div>

        <div className="border-t border-[var(--line)] bg-[var(--paper2)] px-[20px] py-[20px] xl:border-l xl:border-t-0">
          <div className="flex flex-col gap-3">
            <div className="rounded-[12px] border border-[var(--line)] bg-[var(--paper)] px-[16px] py-[14px]">
              <Eyebrow>Tác vụ chính</Eyebrow>
              <div className="mt-3 flex flex-col gap-3">
                {paymentFormEnabled ? (
                  <ButtonLink href="#payment-qr" variant="ghost" full>
                    Mở QR &amp; payment
                  </ButtonLink>
                ) : (
                  <Btn variant="ghost" full disabled>
                    Ghi nhận thanh toán
                  </Btn>
                )}
                {issueAction ?? (
                  <Btn variant="ghost" full disabled>
                    Xuất vé
                  </Btn>
                )}
                {cancelAction ?? (
                  <Btn variant="ghost" full disabled>
                    Hủy booking
                  </Btn>
                )}
              </div>
            </div>

            <div className="rounded-[12px] border border-[var(--line)] bg-[var(--paper)] px-[16px] py-[14px]">
              <Eyebrow>Tóm tắt nghiệp vụ</Eyebrow>
              <div className="mt-2">
                <MetaRow label="Kênh" value={booking.channel} />
                <MetaRow label="Nguồn" value={booking.source} />
                <MetaRow label="Trạng thái hiện tại" value={<StatusChip status={booking.status} dot={false} />} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
