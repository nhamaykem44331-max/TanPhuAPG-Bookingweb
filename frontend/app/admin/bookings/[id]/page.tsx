import type {
  NotificationAudience,
  NotificationJobChannel,
  NotificationJobStatus,
  PaymentMethod,
} from "@prisma/client";
import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderActions } from "@/components/admin/bookings/OrderActions";
import { Chip, MiniChip, StatusChip } from "@/components/admin/ui/Chip";
import { PageHead } from "@/components/admin/ui/PageHead";
import { Panel, PanelHeading } from "@/components/admin/ui/Panel";
import { StatTile } from "@/components/admin/ui/Stat";
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

// Hàng "khoản mục · số tiền" trong khối bóc tách giá — dáng ô bảng Manager (13.5px, --ink2).
function MoneyRow({
  label,
  value,
  valueClassName,
  strong,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 border-b border-[var(--line)] px-[18px] last:border-b-0 ${
        strong ? "py-[13px]" : "py-[11px]"
      }`}
    >
      <span className={`text-[13px] ${strong ? "font-semibold text-[var(--ink)]" : "text-[var(--ink2)]"}`}>{label}</span>
      <span className={`ofly-num text-[13.5px] font-semibold text-[var(--ink)] ${valueClassName ?? ""}`}>{value}</span>
    </div>
  );
}

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
      {/* Link quay lại dùng chung một dạng với các màn admin khác: icon lucide, 13px, --ink2. */}
      <Link
        href="/admin/bookings"
        className="mb-[18px] inline-flex w-fit items-center gap-[7px] text-[13px] font-semibold text-[var(--ink2)] transition-colors hover:text-[var(--ink)]"
      >
        <ArrowLeft size={15} strokeWidth={1.5} aria-hidden="true" />
        Tất cả đơn
      </Link>

      {/* Đầu màn theo PageHead của Manager: mã đơn là "danh tính" nên đặt ở tiêu đề, dùng mono. */}
      <PageHead
        eyebrow="Chi tiết đơn"
        title={<span className="ofly-num">{booking.orderCode}</span>}
        sub={`${booking.airline ?? "—"} · ${formatRoute(booking.routeSummary)} · ${headerSub}`}
        actions={
          <>
            <StatusChip status={booking.status} />
            <StatTile label="PNR" value={booking.pnr || "—"} tone="rust" minWidth={118} />
            <StatTile label="Khách trả" value={formatVnd(booking.saleAmount)} tone="navy" minWidth={150} />
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_344px]">
        {/* LEFT */}
        <div className="flex flex-col gap-3">
          <Panel>
            <PanelHeading
              eyebrow="Hành trình"
              action={
                booking.priceLockedAt ? (
                  <span className="inline-flex items-center gap-[7px] rounded-[8px] border border-[var(--line)] bg-[var(--paper2)] px-[11px] py-[7px]">
                    <Lock size={13} strokeWidth={1.5} className="text-[var(--rust)]" />
                    <span className="text-[11px] leading-[1.35] text-[var(--ink2)]">
                      <span className="font-semibold text-[var(--ink)]">Giá đã khoá</span>
                      <br />
                      <span className="ofly-num text-[var(--ink3)]">{formatDateTime(booking.priceLockedAt)}</span>
                    </span>
                  </span>
                ) : null
              }
            />
            <div className="ofly-serif mt-[14px] text-[30px] font-medium leading-none tracking-[-1.2px] text-[var(--ink)]">
              {formatRoute(booking.routeSummary)}
            </div>
            <div className="mt-[10px] text-[13px] text-[var(--ink3)]">{headerSub}</div>
          </Panel>

          {itinerary && itinerary.legs.length > 0 ? (
            <Panel>
              <PanelHeading eyebrow="Chi tiết chuyến bay" />
              <div className="mt-[18px] flex flex-col gap-[18px]">
                {itinerary.legs.map((leg, legIndex) => (
                  <div
                    key={`${leg.direction}-${leg.route}-${legIndex}`}
                    className={legIndex > 0 ? "border-t border-[var(--line)] pt-[18px]" : ""}
                  >
                    <div className="mb-[12px] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-[10px]">
                        <MiniChip tone="muted">{leg.direction === "outbound" ? "Chiều đi" : "Chiều về"}</MiniChip>
                        <span className="ofly-serif text-[18px] font-medium tracking-[-0.4px] text-[var(--ink)]">
                          {formatRoute(leg.route)}
                        </span>
                      </div>
                      <span className="text-[12px] text-[var(--ink3)]">
                        {[leg.airline, leg.cabin].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-[10px]">
                      {leg.segments.map((segment, segmentIndex) => (
                        <div
                          key={`${segment.flightNumber ?? "seg"}-${segmentIndex}`}
                          className="flex items-center gap-[14px] rounded-[10px] border border-[var(--line)] bg-[var(--paper2)] px-[14px] py-[12px]"
                        >
                          <div className="flex w-[68px] flex-none flex-col">
                            <span className="ofly-num text-[13px] font-bold text-[var(--rust)]">
                              {segment.flightNumber ?? "—"}
                            </span>
                            {/* dữ liệu thật trên nền --paper2: --ink4 chỉ đạt ~2.4:1 → dùng --ink3 (§2: ink4 chỉ cho placeholder) */}
                            {segment.aircraft ? (
                              <span className="mt-[3px] text-[11px] text-[var(--ink3)]">{segment.aircraft}</span>
                            ) : null}
                          </div>
                          <div className="flex-1">
                            {/* giờ bay là số → mono (§2), khớp hàng chặng gọn của Manager; serif để dành cho tiêu đề */}
                            <div className="ofly-num text-[15px] font-bold leading-none text-[var(--ink)]">
                              {formatTime(segment.departAt)}
                            </div>
                            <div className="mt-[5px] text-[12px] font-medium text-[var(--ink2)]">{segment.from ?? "—"}</div>
                            <div className="ofly-num text-[11px] text-[var(--ink3)]">{formatDate(segment.departAt, "")}</div>
                          </div>
                          <div className="flex-none text-[var(--ink3)]">→</div>
                          <div className="flex-1 text-right">
                            <div className="ofly-num text-[15px] font-bold leading-none text-[var(--ink)]">
                              {formatTime(segment.arrivalAt)}
                            </div>
                            <div className="mt-[5px] text-[12px] font-medium text-[var(--ink2)]">{segment.to ?? "—"}</div>
                            <div className="ofly-num text-[11px] text-[var(--ink3)]">{formatDate(segment.arrivalAt, "")}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          <Panel>
            <PanelHeading eyebrow="Dòng thời gian đơn" />
            {timeline.length === 0 ? (
              <div className="ofly-serif py-[38px] text-center text-[16px] italic text-[var(--ink3)]">Chưa có sự kiện nào.</div>
            ) : (
              <div className="mt-[18px] flex flex-col">
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
                        <div className="ofly-num mt-[4px] text-[11px] text-[var(--ink3)]">{formatDateTime(event.occurredAt)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeading eyebrow={`Hành khách (${passengers.length})`} />
            {passengers.length === 0 ? (
              <div className="ofly-serif py-[38px] text-center text-[16px] italic text-[var(--ink3)]">
                Chưa đọc được danh sách hành khách.
              </div>
            ) : (
              <div className="mt-[10px]">
                {passengers.map((passenger, index) => (
                  <div
                    key={`${passenger.fullName}-${index}`}
                    className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-[11px] last:border-b-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="ofly-serif flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[var(--paper2)] text-[13px] font-medium text-[var(--ink2)]">
                        {passenger.initial}
                      </span>
                      <span className="truncate text-[14px] font-medium text-[var(--ink)]">{passenger.fullName}</span>
                    </div>
                    <span className="shrink-0 text-[12px] text-[var(--ink3)]">{passenger.roleLabel}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeading eyebrow="Lịch sử thông báo" />
            {notificationJobs.length === 0 ? (
              <div className="ofly-serif py-[38px] text-center text-[16px] italic text-[var(--ink3)]">Chưa có thông báo nào.</div>
            ) : (
              <div className="mt-[10px]">
                {notificationJobs.map((job) => {
                  const meta = NOTIF_STATUS_META[job.status];
                  return (
                    <div key={job.id} className="flex items-start gap-[13px] border-b border-[var(--line)] py-[12px] last:border-b-0">
                      <span
                        className="mt-[6px] inline-block flex-none rounded-full"
                        style={{ width: 7, height: 7, background: toneVars(meta.tone).solid }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium leading-[1.35] text-[var(--ink)]">{notificationTitle(job.type)}</div>
                        <div className="mt-[4px] text-[11px] text-[var(--ink3)]">
                          {`${CHANNEL_LABELS[job.channel]} · ${AUDIENCE_LABELS[job.audience]} · ${formatDateTime(job.scheduledAt)}`}
                        </div>
                      </div>
                      <MiniChip tone={meta.tone}>{meta.label}</MiniChip>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        {/* RIGHT */}
        <div className="flex flex-col gap-3 lg:sticky lg:top-[96px]">
          <Panel>
            <PanelHeading eyebrow="Thao tác đơn" />
            {sla ? (
              <div
                className="mt-[14px] rounded-[10px] border px-[14px] py-[12px]"
                style={{ background: toneVars(sla.tone).bg, borderColor: toneVars(sla.tone).bd }}
              >
                <div className="text-[12px] font-semibold" style={{ color: toneVars(sla.tone).fg }}>
                  {sla.text}
                </div>
                <div className="mt-[4px] text-[11px] text-[var(--ink3)]">{sla.sub}</div>
              </div>
            ) : null}
            <div className="mt-[14px]">
              <OrderActions
                bookingId={booking.id}
                status={booking.status}
                alreadyHandedOff={booking.rmsSyncedAt !== null}
                totalPaid={paymentSummary.totalPaid}
                permissions={permissions}
              />
            </div>
          </Panel>

          {/* Bóc tách giá dựng theo GridHead của Manager: hàng tiêu đề nền --paper2 + các dòng khoản mục. */}
          <Panel padded={false} className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--paper2)] px-[18px] py-[11px] text-[10px] font-bold uppercase leading-none tracking-[0.4px] text-[var(--ink3)]">
              <span>Thanh toán</span>
              <span>Số tiền</span>
            </div>
            <MoneyRow label="Giá net (vốn)" value={formatVnd(booking.netAmount)} />
            <MoneyRow
              label="Markup"
              value={`+ ${formatVnd(booking.markupAmount)}`}
              valueClassName="text-[var(--rust)]"
            />
            <MoneyRow label="Khách trả" value={formatVnd(booking.saleAmount)} strong />
            <div className="flex items-center justify-between gap-3 bg-[var(--paper2)] px-[18px] py-[12px]">
              <span className="text-[12px] text-[var(--ink3)]">{payMethodLabel}</span>
              <Chip tone={payStatusTone}>{payStatusLabel}</Chip>
            </div>
          </Panel>

          <Panel>
            <PanelHeading eyebrow="Khách hàng" />
            <div className="mt-[14px] text-[14px] font-medium text-[var(--ink)]">{customer?.fullName ?? "—"}</div>
            <div className="ofly-num mt-[6px] text-[13px] text-[var(--ink2)]">{customer?.phone ?? "Chưa có số điện thoại"}</div>
            {customer?.email ? <div className="mt-[3px] break-all text-[13px] text-[var(--ink3)]">{customer.email}</div> : null}
          </Panel>
        </div>
      </div>
    </div>
  );
}
