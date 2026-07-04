import type {
  NotificationAudience,
  NotificationJobChannel,
  NotificationJobStatus,
  PaymentMethod,
} from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderActions } from "@/components/admin/bookings/OrderActions";
import { StatusChip } from "@/components/admin/ui/Chip";
import { formatDate, formatDateTime, formatRoute, formatTime, formatVnd } from "@/lib/admin/ui/format";
import { toneVars, type Tone } from "@/lib/admin/ui/tones";
import {
  ADMIN_ROLES,
  CANCEL_BOOKING_ROLES,
  ISSUE_TICKET_ROLES,
  REFUND_MANAGER_ROLES,
  RMS_HANDOFF_ROLES,
  TICKETING_QUEUE_ROLES,
} from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { getAdminBookingById, type AdminBookingCore } from "@/lib/bookings/admin";
import { extractItinerary } from "@/lib/bookings/itinerary";

export const dynamic = "force-dynamic";

interface BookingDetailPageProps {
  params: {
    id: string;
  };
}

interface PassengerView {
  fullName: string;
  initial: string;
  roleLabel: string;
}

const PAY_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Tiền mặt",
  BANK: "Chuyển khoản",
  QR: "QR code",
  CARD: "Thẻ",
  CREDIT: "Công nợ",
};

const CHANNEL_LABELS: Record<NotificationJobChannel, string> = {
  EMAIL: "Email",
  SLACK: "Slack",
  TELEGRAM: "Telegram",
  INTERNAL: "Nội bộ",
  ZALO_OA: "Zalo OA",
  ZNS: "ZNS",
};

const AUDIENCE_LABELS: Record<NotificationAudience, string> = {
  INTERNAL: "Nội bộ",
  CUSTOMER: "Khách hàng",
};

const NOTIF_STATUS_META: Record<NotificationJobStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Chờ gửi", tone: "warn" },
  PROCESSING: { label: "Đang gửi", tone: "warn" },
  SENT: { label: "Đã gửi", tone: "ok" },
  FAILED: { label: "Lỗi", tone: "red" },
  CANCELLED: { label: "Đã huỷ", tone: "muted" },
  SKIPPED: { label: "Bỏ qua", tone: "muted" },
};

const NOTIF_TITLES: Record<string, string> = {
  BOOKING_HOLD: "Giữ chỗ",
  BOOKING_HOLD_CREATED: "Tạo yêu cầu giữ chỗ",
  BOOKING_HOLD_CONFIRM: "Xác nhận giữ chỗ thành công",
  BOOKING_ISSUED: "Đã xuất vé · gửi vé điện tử",
  BOOKING_CANCELLED: "Thông báo huỷ đơn",
  SEPAY_PAYMENT_MATCHED: "Đã nhận thanh toán",
  SEPAY_PAYMENT_REVIEW: "Cần đối soát thanh toán",
  SLA_BREACH: "Cảnh báo quá hạn SLA xuất vé",
  HELD_EXPIRING: "Sắp hết hạn giữ chỗ",
  INTERNAL_ALERT: "Cảnh báo nội bộ",
  PAYMENT_REMINDER: "Nhắc thanh toán",
  TICKETING_REQUIRED: "Cần xuất vé",
};

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function arrayOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object") : [];
}

function initialOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1];
  return last ? last[0]!.toUpperCase() : "•";
}

function extractPassengers(booking: AdminBookingCore): PassengerView[] {
  const request = recordOf(recordOf(booking.namthanhRawJson).request);
  const passengers = arrayOf(request.passengers);

  return passengers.map((passenger, index) => {
    const lastName = typeof passenger.lastName === "string" ? passenger.lastName : "";
    const firstName = typeof passenger.firstName === "string" ? passenger.firstName : "";
    const explicit = typeof passenger.fullName === "string" ? passenger.fullName : "";
    const fullName = (explicit || [lastName, firstName].filter(Boolean).join(" ")).trim() || "Chưa rõ";

    return {
      fullName,
      initial: initialOf(fullName),
      roleLabel: index === 0 ? "Người đặt" : "Hành khách",
    };
  });
}

function notificationTitle(type: string): string {
  return NOTIF_TITLES[type] ?? type;
}

export default async function BookingDetailPage({ params }: BookingDetailPageProps) {
  const session = await requireRole(ADMIN_ROLES);
  const detail = await getAdminBookingById(params.id);

  if (!detail) {
    notFound();
  }

  const { booking, customer, timeline, payments, notificationJobs, paymentSummary } = detail;

  if (session.user.role === "NHAN_VIEN_BAN" && booking.createdById !== session.user.id) {
    notFound();
  }

  const role = session.user.role;
  const permissions = {
    issue: ISSUE_TICKET_ROLES.includes(role),
    queueAction: TICKETING_QUEUE_ROLES.includes(role),
    refundConfirm: REFUND_MANAGER_ROLES.includes(role),
    handoff: RMS_HANDOFF_ROLES.includes(role),
    cancel: CANCEL_BOOKING_ROLES.includes(role),
  };

  const passengers = extractPassengers(booking);
  const itinerary = extractItinerary(booking);
  const headerSub =
    [formatDate(booking.departAt, ""), formatTime(booking.departAt, ""), booking.cabin].filter(Boolean).join(" · ") || "—";

  // SLA box (parity design JS 868-873) — tính phía server, an toàn vì trang force-dynamic.
  const now = Date.now();
  let sla: { text: string; sub: string; tone: Tone } | null = null;
  if (booking.status === "PAID") {
    const dueMin = booking.slaDueAt ? Math.round((booking.slaDueAt.getTime() - now) / 60_000) : null;
    const paidMin = booking.paidConfirmedAt ? Math.max(0, Math.round((now - booking.paidConfirmedAt.getTime()) / 60_000)) : null;
    const paidText = paidMin !== null ? `Đã trả tiền ${paidMin} phút trước` : "Đã ghi nhận thanh toán";
    if (dueMin !== null && dueMin < 0) {
      sla = { text: `Quá SLA xuất vé +${Math.abs(dueMin)} phút`, sub: `${paidText} · cần xử lý ngay`, tone: "rust" };
    } else if (dueMin !== null) {
      sla = { text: `Còn ${dueMin} phút trong SLA`, sub: paidText, tone: "warn" };
    } else {
      sla = { text: "Đã thanh toán · chờ xuất vé", sub: paidText, tone: "warn" };
    }
  } else if (booking.status === "TICKETING") {
    sla = { text: "Đang xuất vé", sub: "Đã nhận xử lý", tone: "info" };
  } else if (booking.status === "CANNOT_ISSUE") {
    sla = { text: "Khách đã trả nhưng không xuất được", sub: "Bắt buộc chuyển sang quy trình hoàn tiền", tone: "rust" };
  }

  const settledPayment = [...payments].reverse().find((payment) => payment.status === "PAID" || payment.status === "PARTIAL");
  const payMethodLabel = settledPayment ? PAY_METHOD_LABELS[settledPayment.method] : "—";

  let payStatusLabel: string;
  let payStatusTone: Tone;
  if (booking.status === "REFUNDED") {
    payStatusLabel = "Đã hoàn tiền";
    payStatusTone = "muted";
  } else if (paymentSummary.totalPaid > 0 && paymentSummary.balance <= 0) {
    payStatusLabel = "Đã nhận đủ";
    payStatusTone = "ok";
  } else if (paymentSummary.totalPaid > 0) {
    payStatusLabel = `Còn thiếu ${formatVnd(paymentSummary.balance)}`;
    payStatusTone = "warn";
  } else if (booking.status === "PAYMENT_FAILED") {
    payStatusLabel = "Thanh toán lỗi";
    payStatusTone = "red";
  } else {
    payStatusLabel = "Chưa thanh toán";
    payStatusTone = "warn";
  }

  return (
    <div>
      <Link
        href="/admin/bookings"
        className="mb-[18px] inline-flex items-center gap-[7px] text-[12px] font-medium text-[var(--ink-soft)] transition hover:text-[var(--rust)]"
      >
        ← Tất cả đơn
      </Link>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_344px]">
        {/* LEFT */}
        <div className="flex flex-col gap-5">
          <section className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-[28px] py-[26px]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="ofly-eyebrow mb-[9px]">{`${booking.airline ?? "—"} · ${booking.orderCode}`}</div>
                <div className="ofly-serif text-[34px] font-medium leading-none tracking-[-0.5px]">
                  {formatRoute(booking.routeSummary)}
                </div>
                <div className="mt-[10px] text-[13px] text-[var(--ink-soft)]">{headerSub}</div>
              </div>
              {booking.priceLockedAt ? (
                <div className="flex items-center gap-2 rounded-[8px] border border-[var(--line)] bg-[var(--surface-2)] px-[13px] py-[9px]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--rust)" strokeWidth="2" aria-hidden="true">
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                  <div className="text-[11px] leading-[1.4]">
                    <span className="font-semibold">Giá đã khoá</span>
                    <br />
                    <span className="text-[var(--ink-soft)]">{formatDateTime(booking.priceLockedAt)}</span>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          {itinerary && itinerary.legs.length > 0 ? (
            <section className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-[28px] py-[24px]">
              <div className="ofly-eyebrow mb-5">Chi tiết chuyến bay</div>
              <div className="flex flex-col gap-5">
                {itinerary.legs.map((leg, legIndex) => (
                  <div
                    key={`${leg.direction}-${leg.route}-${legIndex}`}
                    className={legIndex > 0 ? "border-t border-[var(--line)] pt-5" : ""}
                  >
                    <div className="mb-[14px] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-[10px]">
                        <span className="rounded-full bg-[var(--surface-2)] px-[10px] py-[3px] text-[11px] font-semibold text-[var(--ink-soft)]">
                          {leg.direction === "outbound" ? "Chiều đi" : "Chiều về"}
                        </span>
                        <span className="ofly-serif text-[18px] font-medium">{formatRoute(leg.route)}</span>
                      </div>
                      <span className="text-[12px] text-[var(--ink-soft)]">
                        {[leg.airline, leg.cabin].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-[10px]">
                      {leg.segments.map((segment, segmentIndex) => (
                        <div
                          key={`${segment.flightNumber ?? "seg"}-${segmentIndex}`}
                          className="flex items-center gap-[14px] rounded-[8px] border border-[var(--line)] bg-[var(--surface-2)] px-[14px] py-[12px]"
                        >
                          <div className="flex w-[68px] flex-none flex-col">
                            <span className="ofly-sans text-[13px] font-semibold tracking-[0.5px] text-[var(--rust)]">
                              {segment.flightNumber ?? "—"}
                            </span>
                            {segment.aircraft ? (
                              <span className="mt-[2px] text-[10px] text-[var(--ink-faint)]">{segment.aircraft}</span>
                            ) : null}
                          </div>
                          <div className="flex-1">
                            <div className="ofly-serif text-[17px] font-medium leading-none">{formatTime(segment.departAt)}</div>
                            <div className="mt-[4px] text-[12px] font-medium text-[var(--ink-soft)]">{segment.from ?? "—"}</div>
                            <div className="text-[10px] text-[var(--ink-faint)]">{formatDate(segment.departAt, "")}</div>
                          </div>
                          <div className="flex-none text-[var(--ink-faint)]">→</div>
                          <div className="flex-1 text-right">
                            <div className="ofly-serif text-[17px] font-medium leading-none">{formatTime(segment.arrivalAt)}</div>
                            <div className="mt-[4px] text-[12px] font-medium text-[var(--ink-soft)]">{segment.to ?? "—"}</div>
                            <div className="text-[10px] text-[var(--ink-faint)]">{formatDate(segment.arrivalAt, "")}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-[28px] py-[24px]">
            <div className="ofly-eyebrow mb-5">Dòng thời gian đơn</div>
            {timeline.length === 0 ? (
              <div className="text-[13px] italic text-[var(--ink-soft)]">Chưa có sự kiện nào.</div>
            ) : (
              <div className="flex flex-col">
                {timeline.map((event, index) => {
                  const isLast = index === timeline.length - 1;
                  const tone: Tone = isLast ? "rust" : "ok";
                  const dotColor = toneVars(tone).solid;
                  return (
                    <div key={event.id} className="flex gap-[15px]">
                      <div className="flex flex-col items-center">
                        <span
                          className="mt-[3px] flex-none rounded-full"
                          style={{ width: 11, height: 11, background: dotColor, border: `2px solid ${dotColor}`, boxSizing: "border-box" }}
                          aria-hidden="true"
                        />
                        {!isLast ? <span className="flex-1" style={{ width: 2, minHeight: 14, background: "var(--line)" }} aria-hidden="true" /> : null}
                      </div>
                      <div className="flex-1 pb-[18px]">
                        <div className="text-[14px] leading-[1.3] text-[var(--ink)]" style={{ fontWeight: isLast ? 600 : 500 }}>
                          {event.title}
                        </div>
                        <div className="mt-[3px] text-[11px] text-[var(--ink-faint)]">{formatDateTime(event.occurredAt)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-[28px] py-[24px]">
            <div className="ofly-eyebrow mb-4">{`Hành khách (${passengers.length})`}</div>
            {passengers.length === 0 ? (
              <div className="text-[13px] italic text-[var(--ink-soft)]">Chưa đọc được danh sách hành khách.</div>
            ) : (
              passengers.map((passenger, index) => (
                <div
                  key={`${passenger.fullName}-${index}`}
                  className="flex items-center justify-between border-b border-[var(--line)] py-[11px] last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="ofly-serif flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[var(--surface-2)] text-[13px] font-medium text-[var(--ink-soft)]">
                      {passenger.initial}
                    </div>
                    <span className="text-[14px] font-medium">{passenger.fullName}</span>
                  </div>
                  <span className="text-[12px] text-[var(--ink-soft)]">{passenger.roleLabel}</span>
                </div>
              ))
            )}
          </section>

          <section className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-[28px] py-[24px]">
            <div className="ofly-eyebrow mb-4">Lịch sử thông báo</div>
            {notificationJobs.length === 0 ? (
              <div className="text-[13px] italic text-[var(--ink-soft)]">Chưa có thông báo nào.</div>
            ) : (
              notificationJobs.map((job) => {
                const meta = NOTIF_STATUS_META[job.status];
                return (
                  <div key={job.id} className="flex gap-[13px] border-b border-[var(--line)] py-[12px] last:border-b-0">
                    <span
                      className="mt-[5px] inline-block flex-none rounded-full"
                      style={{ width: 7, height: 7, background: toneVars(meta.tone).solid }}
                      aria-hidden="true"
                    />
                    <div className="flex-1">
                      <div className="text-[13px] font-medium leading-[1.35]">{notificationTitle(job.type)}</div>
                      <div className="mt-[3px] text-[11px] text-[var(--ink-soft)]">
                        {`${CHANNEL_LABELS[job.channel]} · ${AUDIENCE_LABELS[job.audience]} · ${formatDateTime(job.scheduledAt)}`}
                      </div>
                    </div>
                    <span className="whitespace-nowrap text-[11px] font-semibold" style={{ color: toneVars(meta.tone).fg }}>
                      {meta.label}
                    </span>
                  </div>
                );
              })
            )}
          </section>
        </div>

        {/* RIGHT */}
        <div className="flex flex-col gap-5 lg:sticky lg:top-[96px]">
          <section className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-[24px]">
            <div className="mb-[14px] flex items-center justify-between gap-3">
              <StatusChip status={booking.status} />
              <span className="ofly-sans text-[13px] font-semibold tracking-[1px] text-[var(--rust)]">{booking.pnr || "—"}</span>
            </div>
            {sla ? (
              <div className="mb-4 rounded-[8px] px-[14px] py-[12px]" style={{ background: toneVars(sla.tone).bg }}>
                <div className="text-[12px] font-semibold" style={{ color: toneVars(sla.tone).fg }}>
                  {sla.text}
                </div>
                <div className="mt-[3px] text-[11px] text-[var(--ink-soft)]">{sla.sub}</div>
              </div>
            ) : null}
            <OrderActions
              bookingId={booking.id}
              status={booking.status}
              alreadyHandedOff={booking.rmsSyncedAt !== null}
              totalPaid={paymentSummary.totalPaid}
              permissions={permissions}
            />
          </section>

          <section className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-[24px]">
            <div className="ofly-eyebrow mb-4">Thanh toán</div>
            <div className="flex justify-between py-[7px] text-[13px]">
              <span className="text-[var(--ink-soft)]">Giá net (vốn)</span>
              <span className="font-medium">{formatVnd(booking.netAmount)}</span>
            </div>
            <div className="flex justify-between py-[7px] text-[13px]">
              <span className="text-[var(--ink-soft)]">Markup</span>
              <span className="font-medium text-[var(--rust)]">+ {formatVnd(booking.markupAmount)}</span>
            </div>
            <div className="mt-[5px] flex justify-between border-t border-[var(--line)] pb-[7px] pt-[11px] text-[14px]">
              <span className="font-semibold">Khách trả</span>
              <span className="ofly-serif text-[18px] font-medium">{formatVnd(booking.saleAmount)}</span>
            </div>
            <div className="mt-[14px] flex items-center justify-between border-t border-[var(--line)] pt-[14px]">
              <span className="text-[12px] text-[var(--ink-soft)]">{payMethodLabel}</span>
              <span className="text-[11px] font-semibold" style={{ color: toneVars(payStatusTone).fg }}>
                {payStatusLabel}
              </span>
            </div>
          </section>

          <section className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-[24px]">
            <div className="ofly-eyebrow mb-[14px]">Khách hàng</div>
            <div className="text-[14px] font-medium">{customer?.fullName ?? "—"}</div>
            <div className="mt-[5px] text-[13px] text-[var(--ink-soft)]">{customer?.phone ?? "Chưa có số điện thoại"}</div>
            {customer?.email ? <div className="mt-[3px] text-[13px] text-[var(--ink-soft)]">{customer.email}</div> : null}
          </section>
        </div>
      </div>
    </div>
  );
}
