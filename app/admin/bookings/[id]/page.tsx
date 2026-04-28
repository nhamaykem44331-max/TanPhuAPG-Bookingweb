import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ADMIN_ROLES,
  CANCEL_BOOKING_ROLES,
  ISSUE_TICKET_ROLES,
  PAYMENT_CAPTURE_ROLES,
  PAYMENT_REJECT_ROLES,
} from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { bookingAccessBadge } from "@/lib/auth/ownership";
import { canTransition } from "@/lib/booking/stateMachine";
import type { AdminBookingCore, AdminBookingTimelineEvent } from "@/lib/bookings/admin";
import { getAdminBookingById } from "@/lib/bookings/admin";
import { BookingDetailHeader } from "@/components/admin/BookingDetailHeader";
import { BookingPaymentsTable } from "@/components/admin/BookingPaymentsTable";
import { BookingPriceBreakdown } from "@/components/admin/BookingPriceBreakdown";
import { BookingTimeline } from "@/components/admin/BookingTimeline";
import { CancelBookingDialog } from "@/components/admin/CancelBookingDialog";
import { IssueTicketDialog } from "@/components/admin/IssueTicketDialog";
import { PaymentForm } from "@/components/admin/PaymentForm";
import { PaymentIntentPanel } from "@/components/admin/PaymentIntentPanel";

interface BookingDetailPageProps {
  params: {
    id: string;
  };
}

interface BookingPassengerView {
  type: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  dob: string | null;
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

function formatDate(value: Date | string | null): string {
  if (!value) {
    return "-";
  }

  const date = typeof value === "string" ? new Date(`${value}T00:00:00+07:00`) : value;

  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "-";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatCurrency(value: number, currency: string | null | undefined = "VND"): string {
  return currency === "VND" || !currency ? `${formatMoney(value)} ₫` : `${formatMoney(value)} ${currency}`;
}

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function arrayOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object") : [];
}

function formatTripType(value: string): string {
  return value === "ROUNDTRIP" ? "Khứ hồi" : "Một chiều";
}

function describeCountdown(value: Date | null): string {
  if (!value) {
    return "Không có hạn giữ chỗ.";
  }

  const diffMs = value.getTime() - Date.now();

  if (diffMs <= 0) {
    return "Đã hết hạn giữ chỗ.";
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `Còn ${minutes} phút.`;
  }

  return `Còn ${hours} giờ ${minutes} phút.`;
}

function extractPassengers(booking: AdminBookingCore, timeline: AdminBookingTimelineEvent[]): BookingPassengerView[] {
  const rawBooking = recordOf(booking.namthanhRawJson);
  const request = recordOf(rawBooking.request);
  const requestPassengers = arrayOf(request.passengers);

  if (requestPassengers.length > 0) {
    return requestPassengers.map((passenger) => {
      const lastName = typeof passenger.lastName === "string" ? passenger.lastName : null;
      const firstName = typeof passenger.firstName === "string" ? passenger.firstName : null;
      const fullName =
        [lastName, firstName]
          .filter((value): value is string => !!value && value.trim().length > 0)
          .join(" ")
          .trim() || "Chưa rõ";

      return {
        type: typeof passenger.type === "string" ? passenger.type : "ADT",
        fullName,
        firstName,
        lastName,
        dob: typeof passenger.dob === "string" ? passenger.dob : null,
      };
    });
  }

  const holdCreated = timeline.find((event) => event.eventType === "HOLD_CREATED");
  const holdPayload = recordOf(holdCreated?.payload);
  const holdResult = recordOf(holdPayload.holdResult);

  if (typeof holdResult.passenger === "string" && holdResult.passenger.trim()) {
    return [
      {
        type: "ADT",
        fullName: holdResult.passenger.trim(),
        firstName: null,
        lastName: null,
        dob: null,
      },
    ];
  }

  return [];
}

function pnrUrgencyLabel(timelimit: Date | null): { label: string; className: string } {
  if (!timelimit) {
    return {
      label: "Chưa có time limit",
      className: "border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] text-[var(--apg-text-secondary)]",
    };
  }

  const diffMs = timelimit.getTime() - Date.now();

  if (diffMs <= 0) {
    return {
      label: "Đã hết hạn",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  if (diffMs <= 2 * 60 * 60 * 1000) {
    return {
      label: "Sắp hết hạn",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "Còn hiệu lực",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

function routeLabel(value: string | null): string {
  return value && value.trim() ? value.replace(/-/g, " → ") : "-";
}

function displayValue(value: string | null | undefined): string {
  return value && value.trim() ? value : "-";
}

function pnrStatusClass(status: string | null): string {
  if (status === "SUCCESS" || status === "HELD") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "PENDING") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (!status) {
    return "border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] text-[var(--apg-text-secondary)]";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default async function BookingDetailPage({ params }: BookingDetailPageProps) {
  const session = await requireRole(ADMIN_ROLES);

  const detail = await getAdminBookingById(params.id);

  if (!detail) {
    notFound();
  }

  const { booking, customer, pnrs, timeline, payments, paymentIntents, notificationJobs, appliedMarkupRule, paymentSummary } = detail;

  if (session.user.role === "NHAN_VIEN_BAN" && booking.createdById !== session.user.id) {
    notFound();
  }

  const accessBadge = bookingAccessBadge({ userId: session.user.id, role: session.user.role }, booking);
  const passengers = extractPassengers(booking, timeline);
  const canCapturePayment =
    PAYMENT_CAPTURE_ROLES.includes(session.user.role) &&
    (booking.status === "HELD" || booking.status === "TICKETED") &&
    paymentSummary.balance > 0;
  const canManagePaymentQr =
    PAYMENT_CAPTURE_ROLES.includes(session.user.role) &&
    (booking.status === "HELD" || booking.status === "TICKETED");
  const canRejectPayments = PAYMENT_REJECT_ROLES.includes(session.user.role);
  const issueTransition = canTransition(booking.status, "issue");
  const hasSuccessPnr = pnrs.some((pnr) => pnr.status === "SUCCESS");
  const ttlExpired = booking.ttlExpiresAt ? booking.ttlExpiresAt.getTime() < Date.now() : false;
  const issueDisabledReason = !ISSUE_TICKET_ROLES.includes(session.user.role)
    ? "Bạn không có quyền xuất vé."
    : !issueTransition.ok
      ? issueTransition.reason
      : paymentSummary.balance !== 0
        ? `Booking còn công nợ ${formatCurrency(paymentSummary.balance, booking.currency)}.`
        : ttlExpired
          ? "Booking đã hết hạn giữ chỗ."
          : !hasSuccessPnr
            ? "Booking chưa có PNR SUCCESS."
            : null;
  const issueAction = (
    <IssueTicketDialog
      balance={paymentSummary.balance}
      bookingId={booking.id}
      currency={booking.currency}
      disabled={!!issueDisabledReason}
      disabledReason={issueDisabledReason}
      passengerNames={passengers.map((passenger) => passenger.fullName)}
      pnr={booking.orderCode}
      totalDue={paymentSummary.totalDue}
      totalPaid={paymentSummary.totalPaid}
    />
  );
  const cancelTransition = canTransition(booking.status, "cancel");
  const cancelDisabledReason = !CANCEL_BOOKING_ROLES.includes(session.user.role)
    ? "Bạn không có quyền hủy booking."
    : !cancelTransition.ok
      ? cancelTransition.reason
      : null;
  const canMarkRefund = booking.status === "TICKETED" && payments.some((payment) => payment.status === "PAID");
  const cancelAction = (
    <CancelBookingDialog
      bookingId={booking.id}
      canMarkRefund={canMarkRefund}
      currency={booking.currency}
      disabled={!!cancelDisabledReason}
      disabledReason={cancelDisabledReason}
      status={booking.status}
      totalPaid={paymentSummary.totalPaid}
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--apg-text-secondary)]">
        <Link className="font-semibold text-[var(--apg-aviation-navy)] hover:underline" href="/admin/bookings">
          ← Quay lại danh sách booking
        </Link>
        <span className="apg-chip">Đơn hàng {booking.orderCode}</span>
        <span className="apg-chip">PNR chính {booking.pnr || "PENDING"}</span>
        <span className="apg-chip">{booking.airline || "Chưa có hãng"}</span>
      </div>

      <BookingDetailHeader
        accessBadge={accessBadge}
        booking={booking}
        cancelAction={cancelAction}
        issueAction={issueAction}
        paymentFormEnabled={canCapturePayment}
        paymentSummary={paymentSummary}
      />

      <section className="apg-admin-sheet overflow-hidden">
        <div className="border-b border-[var(--apg-border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(238,242,245,0.98))] px-5 py-4 lg:px-6">
          <p className="apg-eyebrow">Flight Deck</p>
          <h3 className="mt-2 text-2xl font-semibold text-[var(--apg-aviation-navy-deep)]">Thông tin chuyến bay và time limit</h3>
        </div>

        <div className="p-5 lg:p-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <article className="apg-admin-stat px-4 py-4">
              <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Hành trình</div>
              <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{booking.routeSummary}</div>
            </article>

            <article className="apg-admin-stat px-4 py-4">
              <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Loại chuyến</div>
              <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{formatTripType(booking.tripType)}</div>
            </article>

            <article className="apg-admin-stat px-4 py-4">
              <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Khởi hành</div>
              <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{formatDateTime(booking.departAt)}</div>
            </article>

            <article className="apg-admin-stat px-4 py-4">
              <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Chiều về</div>
              <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{formatDateTime(booking.returnAt)}</div>
            </article>

            <article className="apg-admin-stat px-4 py-4">
              <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Cabin</div>
              <div className="mt-2 text-base font-semibold uppercase text-[var(--apg-aviation-navy-deep)]">{displayValue(booking.cabin)}</div>
            </article>

            <article className="apg-admin-stat px-4 py-4">
              <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Số lượng khách</div>
              <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">
                ADT {booking.adt} · CHD {booking.chd} · INF {booking.inf}
              </div>
            </article>

            <article className="apg-admin-stat px-4 py-4 xl:col-span-2">
              <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">TTL giữ chỗ</div>
              <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{formatDateTime(booking.ttlExpiresAt)}</div>
              {booking.status === "HELD" ? (
                <div className="mt-2 text-sm text-[var(--apg-text-secondary)]">
                  TTL đơn hàng lấy theo PNR hết hạn sớm nhất. {describeCountdown(booking.ttlExpiresAt)}
                </div>
              ) : null}
            </article>
          </div>
        </div>
      </section>

      <BookingPriceBreakdown appliedMarkupRule={appliedMarkupRule} booking={booking} />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="apg-admin-sheet overflow-hidden">
          <div className="border-b border-[var(--apg-border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(238,242,245,0.98))] px-5 py-4 lg:px-6">
            <p className="apg-eyebrow">Customer Hub</p>
            <h3 className="mt-2 text-2xl font-semibold text-[var(--apg-aviation-navy-deep)]">Khách hàng gắn với booking</h3>
          </div>

          <div className="p-5 lg:p-6">
            {customer ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Link className="text-xl font-semibold text-[var(--apg-aviation-navy)] hover:underline" href={`/admin/customers/${customer.id}`}>
                    {customer.fullName}
                  </Link>
                  {customer.blacklisted ? (
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                      Blacklist
                    </span>
                  ) : (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Hồ sơ sạch
                    </span>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <article className="apg-admin-stat px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Điện thoại</div>
                    <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{displayValue(customer.phone)}</div>
                  </article>
                  <article className="apg-admin-stat px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Email</div>
                    <div className="mt-2 break-all text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{displayValue(customer.email)}</div>
                  </article>
                  <article className="apg-admin-stat px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">CMND / CCCD</div>
                    <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{displayValue(customer.idNumber)}</div>
                  </article>
                  <article className="apg-admin-stat px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Passport / Ngày sinh</div>
                    <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">
                      {displayValue(customer.passport)} · {formatDate(customer.dob)}
                    </div>
                  </article>
                </div>
              </div>
            ) : (
              <div className="rounded-[20px] border border-dashed border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-4 py-10 text-center text-sm text-[var(--apg-text-secondary)]">
                Booking này chưa gắn với customer record.
              </div>
            )}
          </div>
        </div>

        <div className="apg-admin-sheet overflow-hidden">
          <div className="border-b border-[var(--apg-border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(238,242,245,0.98))] px-5 py-4 lg:px-6">
            <p className="apg-eyebrow">Passengers</p>
            <h3 className="mt-2 text-2xl font-semibold text-[var(--apg-aviation-navy-deep)]">Danh sách hành khách</h3>
          </div>

          <div className="p-5 lg:p-6">
            {passengers.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-4 py-10 text-center text-sm text-[var(--apg-text-secondary)]">
                Chưa đọc được passenger list từ snapshot booking.
              </div>
            ) : (
              <div className="space-y-3">
                {passengers.map((passenger, index) => (
                  <article key={`${passenger.fullName}-${index}`} className="apg-admin-toolbar px-4 py-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full border border-[var(--apg-border-default)] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">
                        {passenger.type}
                      </span>
                      <div className="text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{passenger.fullName}</div>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-[var(--apg-text-secondary)] md:grid-cols-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em]">Họ</div>
                        <div className="mt-1 font-medium text-[var(--apg-aviation-navy-deep)]">{displayValue(passenger.lastName)}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em]">Tên</div>
                        <div className="mt-1 font-medium text-[var(--apg-aviation-navy-deep)]">{displayValue(passenger.firstName)}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em]">Ngày sinh</div>
                        <div className="mt-1 font-medium text-[var(--apg-aviation-navy-deep)]">{formatDate(passenger.dob)}</div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <BookingTimeline fallbackActorId={booking.createdById} timeline={timeline} />

      {(canManagePaymentQr || paymentIntents.length > 0) ? (
        <PaymentIntentPanel
          balance={paymentSummary.balance}
          bookingId={booking.id}
          canManage={canManagePaymentQr}
          currency={booking.currency}
          notificationJobs={notificationJobs}
          paymentIntents={paymentIntents}
        />
      ) : null}

      {canCapturePayment ? <PaymentForm balance={paymentSummary.balance} bookingId={booking.id} currency={booking.currency} /> : null}

      <BookingPaymentsTable
        bookingId={booking.id}
        canRejectPayments={canRejectPayments}
        currency={booking.currency}
        paymentSummary={paymentSummary}
        payments={payments}
      />

      <section className="apg-admin-sheet overflow-hidden">
        <div className="border-b border-[var(--apg-border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(238,242,245,0.98))] px-5 py-4 lg:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="apg-eyebrow">PNR Control</p>
              <h3 className="mt-2 text-2xl font-semibold text-[var(--apg-aviation-navy-deep)]">PNR và time limit</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--apg-text-secondary)]">
              <span className="apg-chip">{pnrs.length} bản ghi PNR</span>
              <span className="apg-chip">{hasSuccessPnr ? "Có PNR SUCCESS" : "Chưa có PNR SUCCESS"}</span>
            </div>
          </div>
        </div>

        <div className="p-5 lg:p-6">
          {pnrs.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-4 py-10 text-center text-sm text-[var(--apg-text-secondary)]">
              Booking này chưa có PNR record.
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:hidden">
                {pnrs.map((pnr) => {
                  const urgency = pnrUrgencyLabel(pnr.timelimit);

                  return (
                    <article key={pnr.id} className="rounded-[22px] border border-[var(--apg-border-default)] bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.16em] text-[var(--apg-text-secondary)]">{pnr.airline || "Airline"}</div>
                          <div className="mt-2 text-xl font-semibold text-[var(--apg-aviation-navy-deep)]">{pnr.pnr}</div>
                        </div>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${pnrStatusClass(pnr.status)}`}>{pnr.status || "-"}</span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-[var(--apg-text-secondary)]">
                        <div className="col-span-2">
                          <div className="text-xs uppercase tracking-[0.16em]">Hành trình</div>
                          <div className="mt-1 text-[var(--apg-aviation-navy-deep)]">{routeLabel(pnr.routeSummary)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.16em]">Khởi hành</div>
                          <div className="mt-1 text-[var(--apg-aviation-navy-deep)]">{formatDateTime(pnr.departAt)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.16em]">Time limit</div>
                          <div className="mt-1 text-[var(--apg-aviation-navy-deep)]">{formatDateTime(pnr.timelimit)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.16em]">Cảnh báo</div>
                          <div className="mt-1">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${urgency.className}`}>{urgency.label}</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="apg-admin-table min-w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="px-5 py-4 font-semibold">PNR</th>
                      <th className="px-4 py-4 font-semibold">Airline</th>
                      <th className="px-4 py-4 font-semibold">Hành trình</th>
                      <th className="px-4 py-4 font-semibold">Khởi hành</th>
                      <th className="px-4 py-4 font-semibold">Status</th>
                      <th className="px-4 py-4 font-semibold">Time limit</th>
                      <th className="px-5 py-4 font-semibold">Cảnh báo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pnrs.map((pnr) => {
                      const urgency = pnrUrgencyLabel(pnr.timelimit);

                      return (
                        <tr key={pnr.id} className="border-t border-[var(--apg-border-default)] align-top">
                          <td className="px-5 py-4 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{pnr.pnr}</td>
                          <td className="px-4 py-4 text-[var(--apg-aviation-navy-deep)]">{pnr.airline || "-"}</td>
                          <td className="px-4 py-4 text-[var(--apg-aviation-navy-deep)]">{routeLabel(pnr.routeSummary)}</td>
                          <td className="px-4 py-4 text-[var(--apg-aviation-navy-deep)]">{formatDateTime(pnr.departAt)}</td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${pnrStatusClass(pnr.status)}`}>{pnr.status || "-"}</span>
                          </td>
                          <td className="px-4 py-4 text-[var(--apg-aviation-navy-deep)]">{formatDateTime(pnr.timelimit)}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${urgency.className}`}>{urgency.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
