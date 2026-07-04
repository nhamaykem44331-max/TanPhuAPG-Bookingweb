import { NotificationJobChannel, NotificationJobStatus, type NotificationJob, type PaymentIntent, type Prisma } from "@prisma/client";

import { calculatePaymentSummary } from "@/lib/booking/paymentSummary";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { sendEmail } from "@/lib/notifications/channels/email";
import { isTelegramEnabled, sendTelegram } from "@/lib/notifications/channels/telegram";
import { isZaloOaEnabled, sendZaloOa } from "@/lib/notifications/channels/zalo";
import { isZnsEnabled, sendZns, type ZnsMessage } from "@/lib/notifications/channels/zns";
import { renderBookingHold } from "@/lib/notifications/templates/bookingHold";
import { renderBookingPaymentReminder } from "@/lib/notifications/templates/bookingPaymentReminder";

interface ProcessNotificationJobsResult {
  claimed: number;
  sent: number;
  skipped: number;
  cancelled: number;
  failed: number;
}

type DueNotificationJob = Prisma.NotificationJobGetPayload<{
  include: {
    booking: {
      include: {
        customer: true;
        pnrs: {
          orderBy: { createdAt: "asc" };
        };
        payments: {
          select: {
            amount: true;
            status: true;
          };
        };
      };
    };
    paymentIntent: true;
  };
}>;

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

function formatMoney(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function appBaseUrl(): string {
  const raw = process.env.NEXTAUTH_URL || process.env.APP_BASE_URL || "https://tanphuapg.com";
  const normalized = raw.startsWith("http") ? raw : `https://${raw}`;
  return normalized.replace(/\/+$/, "");
}

function bookingAdminUrl(bookingId: string): string {
  return `${appBaseUrl()}/admin/bookings/${bookingId}`;
}

function asRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

// Cảnh báo nội bộ (Zalo OA / Telegram) — text hành động cho nhân viên xử lý.
function renderOpsAlertText(job: DueNotificationJob): string | null {
  const booking = job.booking;

  if (!booking) {
    return null;
  }

  const payload = asRecord(job.payload);
  const pnr = booking.pnr ?? booking.pnrs[0]?.pnr ?? "PENDING";
  const route = booking.routeSummary;
  const adminLine = `Admin: ${bookingAdminUrl(booking.id)}`;

  if (job.type === "NEEDS_TICKETING") {
    return [
      "*CẦN XUẤT VÉ*",
      `Đơn: ${booking.orderCode}`,
      `PNR: ${pnr}`,
      `Chặng: ${route}`,
      `Hạn xuất: ${formatDateTime(booking.slaDueAt)}`,
      adminLine,
    ].join("\n");
  }

  if (job.type === "SLA_BREACH") {
    return [
      "*QUÁ HẠN SLA XUẤT VÉ*",
      `Đơn: ${booking.orderCode}`,
      `PNR: ${pnr}`,
      `Chặng: ${route}`,
      `Hạn: ${formatDateTime(booking.slaDueAt)}`,
      adminLine,
    ].join("\n");
  }

  if (job.type === "HELD_EXPIRING") {
    return [
      "*SẮP HẾT HẠN GIỮ CHỖ*",
      `Đơn: ${booking.orderCode}`,
      `PNR: ${pnr}`,
      `Chặng: ${route}`,
      `Hết hạn: ${formatDateTime(booking.ttlExpiresAt)}`,
      adminLine,
    ].join("\n");
  }

  if (job.type === "CANNOT_ISSUE") {
    return [
      "*KHÔNG XUẤT ĐƯỢC VÉ*",
      `Đơn: ${booking.orderCode}`,
      `PNR: ${pnr}`,
      `Chặng: ${route}`,
      `Lý do: ${String(payload.reason ?? "-")}`,
      adminLine,
    ].join("\n");
  }

  return null;
}

function znsTemplateId(type: string): string | undefined {
  if (type === "TICKET_ISSUED") {
    return process.env.ZNS_TEMPLATE_TICKET_ISSUED;
  }

  if (type === "REFUND_DONE") {
    return process.env.ZNS_TEMPLATE_REFUND_DONE;
  }

  if (type === "CANNOT_ISSUE") {
    return process.env.ZNS_TEMPLATE_CANNOT_ISSUE;
  }

  return undefined;
}

// Tin cho khách (ZNS) — cần số điện thoại + template_id đã duyệt.
function buildZnsMessage(job: DueNotificationJob): { ok: true; message: ZnsMessage } | { ok: false; reason: string } {
  const booking = job.booking;

  if (!booking) {
    return { ok: false, reason: "BOOKING_NOT_FOUND" };
  }

  const phone = booking.customer?.phone;

  if (!phone) {
    return { ok: false, reason: "CUSTOMER_PHONE_NOT_FOUND" };
  }

  const templateId = znsTemplateId(job.type);

  if (!templateId) {
    return { ok: false, reason: `ZNS_TEMPLATE_NOT_CONFIGURED:${job.type}` };
  }

  const payload = asRecord(job.payload);
  const templateData: Record<string, string> = {
    order_code: booking.orderCode,
    route: booking.routeSummary,
  };

  if (job.type === "REFUND_DONE") {
    templateData.amount = formatMoney(Number(payload.amount ?? 0));
  }

  return { ok: true, message: { phone, templateId, templateData } };
}

function isEmailTransportEnabled(): boolean {
  return process.env.NOTIFICATIONS_EMAIL_ENABLED === "true" && !!process.env.SMTP_HOST;
}

function isReminderType(type: string): boolean {
  return type === "PAYMENT_REMINDER_T_MINUS_2H" || type === "PAYMENT_REMINDER_T_MINUS_30M";
}

function reminderLabel(type: string): string {
  if (type === "PAYMENT_REMINDER_T_MINUS_2H") {
    return "còn 2 giờ";
  }

  if (type === "PAYMENT_REMINDER_T_MINUS_30M") {
    return "còn 30 phút";
  }

  return "đến hạn";
}

function buildEmailContext(job: DueNotificationJob) {
  const booking = job.booking;

  if (!booking?.customer?.email) {
    return null;
  }

  const paymentSummary = calculatePaymentSummary(booking.payments, booking.saleAmount);
  const pnr = booking.pnr ?? booking.pnrs[0]?.pnr ?? "PENDING";

  return {
    customerName: booking.customer.fullName || "Quý khách",
    customerEmail: booking.customer.email,
    pnr,
    route: booking.routeSummary,
    departAt: formatDateTime(booking.departAt),
    passengerCount: booking.adt + booking.chd + booking.inf,
    sellAmount: formatMoney(booking.saleAmount),
    paymentDue: paymentSummary.balance > 0 ? formatMoney(paymentSummary.balance) : "0",
    currency: booking.currency,
    ttlExpiresAt: formatDateTime(booking.ttlExpiresAt),
    checkoutUrl: job.paymentIntent?.checkoutUrl ?? null,
    transferContent: job.paymentIntent?.transferContent ?? null,
    accountNumber: job.paymentIntent?.accountNumber ?? null,
    accountName: job.paymentIntent?.accountName ?? null,
    paymentSummary,
  };
}

function terminalIntentStatus(intent: PaymentIntent | null): boolean {
  if (!intent) {
    return true;
  }

  return ["PAID", "EXPIRED", "CANCELLED", "FAILED", "MANUAL_REVIEW"].includes(intent.status);
}

async function claimJob(jobId: string): Promise<DueNotificationJob | null> {
  const claim = await prisma.notificationJob.updateMany({
    where: {
      id: jobId,
      status: NotificationJobStatus.PENDING,
    },
    data: {
      status: NotificationJobStatus.PROCESSING,
      attempts: { increment: 1 },
      lastError: null,
    },
  });

  if (claim.count === 0) {
    return null;
  }

  return prisma.notificationJob.findUnique({
    where: { id: jobId },
    include: {
      booking: {
        include: {
          customer: true,
          pnrs: {
            orderBy: { createdAt: "asc" },
          },
          payments: {
            select: {
              amount: true,
              status: true,
            },
          },
        },
      },
      paymentIntent: true,
    },
  }) as Promise<DueNotificationJob | null>;
}

async function finishJob(
  jobId: string,
  status: NotificationJobStatus,
  options?: { lastError?: string | null; sentAt?: Date | null },
): Promise<void> {
  await prisma.notificationJob.update({
    where: { id: jobId },
    data: {
      status,
      lastError: options?.lastError ?? null,
      sentAt: options?.sentAt ?? null,
    },
  });
}

async function cancelJob(job: DueNotificationJob, lastError: string): Promise<"cancelled"> {
  await finishJob(job.id, NotificationJobStatus.CANCELLED, { lastError });
  return "cancelled";
}

async function skipJob(job: DueNotificationJob, lastError: string): Promise<"skipped"> {
  await finishJob(job.id, NotificationJobStatus.SKIPPED, { lastError });
  return "skipped";
}

async function deliverJob(job: DueNotificationJob): Promise<"sent" | "skipped" | "cancelled"> {
  switch (job.channel) {
    case NotificationJobChannel.EMAIL:
      return deliverEmailJob(job);
    case NotificationJobChannel.ZALO_OA:
      return deliverOpsAlertJob(job, "zalo");
    case NotificationJobChannel.TELEGRAM:
      return deliverOpsAlertJob(job, "telegram");
    case NotificationJobChannel.ZNS:
      return deliverZnsJob(job);
    case NotificationJobChannel.INTERNAL:
      // Chỉ ghi nhận trong DB, không có kênh phát bên ngoài.
      await finishJob(job.id, NotificationJobStatus.SENT, { sentAt: new Date() });
      return "sent";
    default:
      return skipJob(job, `UNSUPPORTED_CHANNEL:${job.channel}`);
  }
}

async function deliverOpsAlertJob(
  job: DueNotificationJob,
  transport: "zalo" | "telegram",
): Promise<"sent" | "skipped" | "cancelled"> {
  if (!job.booking) {
    return skipJob(job, "BOOKING_NOT_FOUND");
  }

  const text = renderOpsAlertText(job);

  if (!text) {
    return skipJob(job, `UNSUPPORTED_TYPE:${job.type}`);
  }

  if (transport === "zalo") {
    if (!isZaloOaEnabled()) {
      return skipJob(job, "ZALO_TRANSPORT_DISABLED");
    }

    await sendZaloOa({ text });
  } else {
    if (!isTelegramEnabled()) {
      return skipJob(job, "TELEGRAM_TRANSPORT_DISABLED");
    }

    await sendTelegram({ text });
  }

  await finishJob(job.id, NotificationJobStatus.SENT, { sentAt: new Date() });
  return "sent";
}

async function deliverZnsJob(job: DueNotificationJob): Promise<"sent" | "skipped" | "cancelled"> {
  if (!isZnsEnabled()) {
    return skipJob(job, "ZNS_TRANSPORT_DISABLED");
  }

  const built = buildZnsMessage(job);

  if (!built.ok) {
    return skipJob(job, built.reason);
  }

  await sendZns(built.message);
  await finishJob(job.id, NotificationJobStatus.SENT, { sentAt: new Date() });
  return "sent";
}

async function deliverEmailJob(job: DueNotificationJob): Promise<"sent" | "skipped" | "cancelled"> {
  const context = buildEmailContext(job);

  if (!context) {
    return skipJob(job, "CUSTOMER_EMAIL_NOT_FOUND");
  }

  if (isReminderType(job.type)) {
    if (context.paymentSummary.balance <= 0) {
      return cancelJob(job, "BALANCE_ALREADY_ZERO");
    }

    if (!job.booking || !["HELD", "TICKETED"].includes(job.booking.status)) {
      return cancelJob(job, "BOOKING_NOT_PAYABLE");
    }

    if (terminalIntentStatus(job.paymentIntent)) {
      return cancelJob(job, "PAYMENT_INTENT_NOT_ACTIVE");
    }

    if (job.paymentIntent && context.paymentSummary.balance !== job.paymentIntent.amount) {
      return cancelJob(job, "PAYMENT_INTENT_AMOUNT_OUTDATED");
    }

    if (!isEmailTransportEnabled()) {
      return skipJob(job, "EMAIL_TRANSPORT_DISABLED");
    }

    await sendEmail({
      to: context.customerEmail!,
      ...renderBookingPaymentReminder({
        ...context,
        reminderLabel: reminderLabel(job.type),
      }),
    });

    await finishJob(job.id, NotificationJobStatus.SENT, { sentAt: new Date() });
    return "sent";
  }

  if (job.type === "BOOKING_HOLD_CONFIRM") {
    if (!isEmailTransportEnabled()) {
      return skipJob(job, "EMAIL_TRANSPORT_DISABLED");
    }

    await sendEmail({
      to: context.customerEmail!,
      ...renderBookingHold(context),
    });

    await finishJob(job.id, NotificationJobStatus.SENT, { sentAt: new Date() });
    return "sent";
  }

  return skipJob(job, `UNSUPPORTED_TYPE:${job.type}`);
}

async function failJob(job: NotificationJob, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const nextStatus = job.attempts >= job.maxAttempts ? NotificationJobStatus.FAILED : NotificationJobStatus.PENDING;

  await finishJob(job.id, nextStatus, { lastError: message });

  void notify({
    type: "INTERNAL_ALERT",
    severity: "warn",
    message: `Notification job lỗi ${job.type}`,
    context: {
      jobId: job.id,
      bookingId: job.bookingId,
      paymentIntentId: job.paymentIntentId,
      error: message,
      nextStatus,
    },
  });
}

export async function processDueNotificationJobs(
  limit = 20,
  where?: Prisma.NotificationJobWhereInput,
): Promise<ProcessNotificationJobsResult> {
  const dueJobs = await prisma.notificationJob.findMany({
    where: {
      status: NotificationJobStatus.PENDING,
      scheduledAt: { lte: new Date() },
      ...(where ?? {}),
    },
    orderBy: [
      { scheduledAt: "asc" },
      { createdAt: "asc" },
    ],
    take: limit,
  });

  const result: ProcessNotificationJobsResult = {
    claimed: 0,
    sent: 0,
    skipped: 0,
    cancelled: 0,
    failed: 0,
  };

  for (const candidate of dueJobs) {
    const claimedJob = await claimJob(candidate.id);

    if (!claimedJob) {
      continue;
    }

    result.claimed += 1;

    try {
      const outcome = await deliverJob(claimedJob);

      if (outcome === "sent") {
        result.sent += 1;
      } else if (outcome === "skipped") {
        result.skipped += 1;
      } else {
        result.cancelled += 1;
      }
    } catch (error) {
      await failJob(claimedJob, error);
      result.failed += 1;
    }
  }

  return result;
}
