"use client";

import { QRCodeSVG } from "qrcode.react";
import { useRouter } from "next/navigation";
import { startTransition, useMemo, useState } from "react";

import type { AdminBookingNotificationJob, AdminBookingPaymentIntent } from "@/lib/bookings/admin";

interface PaymentIntentPanelProps {
  bookingId: string;
  balance: number;
  currency: string;
  canManage: boolean;
  paymentIntents: AdminBookingPaymentIntent[];
  notificationJobs: AdminBookingNotificationJob[];
}

interface ActionState {
  tone: "success" | "error";
  message: string;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatCurrency(value: number, currency: string | null | undefined = "VND"): string {
  return currency === "VND" || !currency ? `${formatMoney(value)} ₫` : `${formatMoney(value)} ${currency}`;
}

function toDate(value: Date | string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value: Date | string | null): string {
  const date = toDate(value);

  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function effectiveStatus(intent: AdminBookingPaymentIntent): string {
  const expiresAt = toDate(intent.expiresAt);

  if ((intent.status === "PENDING" || intent.status === "PARTIAL") && expiresAt && expiresAt.getTime() <= Date.now()) {
    return "EXPIRED";
  }

  return intent.status;
}

function isActiveIntent(intent: AdminBookingPaymentIntent): boolean {
  const status = effectiveStatus(intent);
  return status === "PENDING" || status === "PARTIAL";
}

function canCancelIntent(intent: AdminBookingPaymentIntent): boolean {
  return isActiveIntent(intent);
}

function intentStatusClassName(status: string): string {
  if (status === "PAID") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "PENDING" || status === "PARTIAL") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "MANUAL_REVIEW") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (status === "CANCELLED" || status === "FAILED" || status === "EXPIRED") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] text-[var(--apg-text-secondary)]";
}

function intentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: "Đang chờ thanh toán",
    PARTIAL: "Đã thu một phần",
    PAID: "Đã thanh toán đủ",
    MANUAL_REVIEW: "Cần kiểm tra tay",
    EXPIRED: "Đã hết hạn",
    CANCELLED: "Đã hủy",
    FAILED: "Tạo lỗi",
  };

  return labels[status] || status;
}

function webhookStatusClassName(status: string): string {
  if (status === "MATCHED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "MANUAL_REVIEW") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (status === "DUPLICATE") {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }

  if (status === "FAILED") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] text-[var(--apg-text-secondary)]";
}

function webhookStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    RECEIVED: "Đã nhận webhook",
    MATCHED: "Đã match payment",
    DUPLICATE: "Webhook trùng",
    MANUAL_REVIEW: "Cần kiểm tra tay",
    IGNORED: "Bỏ qua",
    FAILED: "Lỗi xử lý",
  };

  return labels[status] || status;
}

function jobStatusClassName(status: string): string {
  if (status === "SENT") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "PENDING" || status === "PROCESSING") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "FAILED") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function jobStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: "Chờ gửi",
    PROCESSING: "Đang xử lý",
    SENT: "Đã gửi",
    FAILED: "Gửi lỗi",
    CANCELLED: "Đã hủy",
    SKIPPED: "Bỏ qua",
  };

  return labels[status] || status;
}

function jobTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    BOOKING_HOLD_CONFIRM: "Email xác nhận giữ chỗ",
    PAYMENT_REMINDER_T_MINUS_2H: "Nhắc thanh toán T-2h",
    PAYMENT_REMINDER_T_MINUS_30M: "Nhắc thanh toán T-30m",
  };

  return labels[type] || type;
}

function stateMessage(message: string): ActionState {
  return { tone: "success", message };
}

export function PaymentIntentPanel({
  bookingId,
  balance,
  currency,
  canManage,
  paymentIntents,
  notificationJobs,
}: PaymentIntentPanelProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionState, setActionState] = useState<ActionState | null>(null);

  const activeIntent = useMemo(
    () => paymentIntents.find((intent) => isActiveIntent(intent)) ?? null,
    [paymentIntents],
  );
  const webhookEvents = useMemo(
    () =>
      paymentIntents.flatMap((intent) =>
        intent.bankTransactions.map((transaction) => ({
          ...transaction,
          providerOrderCode: intent.providerOrderCode,
        })),
      ),
    [paymentIntents],
  );
  const manualReviewCount = useMemo(
    () => webhookEvents.filter((event) => event.status === "MANUAL_REVIEW").length,
    [webhookEvents],
  );
  const pendingJobCount = useMemo(
    () => notificationJobs.filter((job) => job.status === "PENDING" || job.status === "PROCESSING").length,
    [notificationJobs],
  );

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setActionState(stateMessage(successMessage));
    } catch {
      setActionState({ tone: "error", message: "Không sao chép được vào clipboard." });
    }
  }

  async function handleCreateIntent() {
    setIsSubmitting(true);
    setActionState(null);

    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/payment-intents`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            message?: string;
            reused?: boolean;
          }
        | null;

      if (!response.ok) {
        setActionState({
          tone: "error",
          message: payload?.message || "Không thể tạo QR payOS cho booking này.",
        });
        return;
      }

      setActionState(
        stateMessage(payload?.reused ? "Đã dùng lại QR payOS đang còn hiệu lực." : "Đã tạo QR payOS mới cho booking."),
      );
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setActionState({
        tone: "error",
        message: "Kết nối đến API payOS bị gián đoạn, vui lòng thử lại.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancelIntent(intentId: string) {
    setIsSubmitting(true);
    setActionState(null);

    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/payment-intents/${intentId}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            message?: string;
            outcome?: "cancelled" | "expired";
          }
        | null;

      if (!response.ok) {
        setActionState({
          tone: "error",
          message: payload?.message || "Không thể hủy QR payOS này.",
        });
        return;
      }

      setActionState(
        stateMessage(
          payload?.outcome === "expired"
            ? "QR đã hết hạn và được đồng bộ lại trạng thái."
            : "Đã hủy QR payOS thành công.",
        ),
      );
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setActionState({
        tone: "error",
        message: "Không thể hủy QR payOS do lỗi kết nối.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="apg-admin-sheet overflow-hidden" id="payment-qr">
      <div className="border-b border-[var(--apg-border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(238,242,245,0.98))] px-5 py-4 lg:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="apg-eyebrow">QR Checkout</p>
            <h3 className="mt-2 text-2xl font-semibold text-[var(--apg-aviation-navy-deep)]">Thanh toán QR động qua payOS</h3>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--apg-text-secondary)]">
              QR luôn được tạo đúng bằng công nợ còn lại của booking. Nếu khách chuyển dư, webhook sẽ giữ giao dịch ở
              trạng thái <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">MANUAL_REVIEW</span> để
              đội vận hành kiểm tra tay thay vì tự cộng vào payment.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--apg-text-secondary)]">
            <span className="apg-chip">{paymentIntents.length} QR record</span>
            <span className="apg-chip">{activeIntent ? "Có QR đang hiệu lực" : "Chưa có QR active"}</span>
            <span className="apg-chip">{manualReviewCount} manual review</span>
            <span className="apg-chip">{pendingJobCount} job chờ gửi</span>
          </div>
        </div>
      </div>

      <div className="p-5 lg:p-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_340px]">
          <div className="space-y-5">
            {activeIntent ? (
              <div className="rounded-[26px] border border-[var(--apg-border-default)] bg-white p-4 shadow-sm sm:p-5">
                <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="rounded-[24px] border border-[var(--apg-border-default)] bg-[radial-gradient(circle_at_top,rgba(36,76,112,0.08),rgba(255,255,255,1))] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">QR active</div>
                        <div className="mt-2 text-lg font-semibold text-[var(--apg-aviation-navy-deep)]">
                          {formatCurrency(activeIntent.amount, currency)}
                        </div>
                      </div>
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${intentStatusClassName(effectiveStatus(activeIntent))}`}
                      >
                        {intentStatusLabel(effectiveStatus(activeIntent))}
                      </span>
                    </div>

                    <div className="mt-4 flex justify-center rounded-[20px] bg-white p-4 shadow-inner">
                      <QRCodeSVG
                        bgColor="#ffffff"
                        fgColor="#16354f"
                        level="M"
                        size={180}
                        value={activeIntent.qrCode || activeIntent.checkoutUrl || activeIntent.transferContent}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <article className="apg-admin-stat px-4 py-4">
                        <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Nội dung chuyển khoản</div>
                        <div className="mt-2 break-all text-base font-semibold text-[var(--apg-aviation-navy-deep)]">
                          {activeIntent.transferContent}
                        </div>
                      </article>
                      <article className="apg-admin-stat px-4 py-4">
                        <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Hết hiệu lực lúc</div>
                        <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">
                          {formatDateTime(activeIntent.expiresAt)}
                        </div>
                      </article>
                      <article className="apg-admin-stat px-4 py-4">
                        <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Tài khoản nhận</div>
                        <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">
                          {activeIntent.accountNumber || "-"}
                        </div>
                        <div className="mt-1 text-xs text-[var(--apg-text-secondary)]">
                          {activeIntent.accountName || "payOS account"}
                        </div>
                      </article>
                      <article className="apg-admin-stat px-4 py-4">
                        <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">payOS link</div>
                        <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">
                          #{activeIntent.providerOrderCode}
                        </div>
                        <div className="mt-1 text-xs text-[var(--apg-text-secondary)]">
                          {activeIntent.paymentLinkId || "Đang sync"}
                        </div>
                      </article>
                    </div>

                    <div className="rounded-[20px] border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-4 py-4 text-sm leading-7 text-[var(--apg-text-secondary)]">
                      Khách có thể quét trực tiếp QR này hoặc mở trang payOS để thanh toán. Khi balance thay đổi, hệ
                      thống sẽ không tạo chồng QR mới lên QR cũ để tránh overpay hoặc hai request thanh toán hoạt động
                      song song.
                    </div>

                    {manualReviewCount > 0 ? (
                      <div className="rounded-[18px] border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700">
                        Booking này đang có {manualReviewCount} webhook payOS cần kiểm tra tay. Anh có thể xem chi tiết
                        ở bảng “Webhook &amp; đối soát” ngay bên dưới.
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-3">
                      {activeIntent.checkoutUrl ? (
                        <a className="apg-btn-primary" href={activeIntent.checkoutUrl} rel="noreferrer" target="_blank">
                          Mở trang payOS
                        </a>
                      ) : null}
                      <button
                        className="apg-btn-secondary"
                        disabled={isSubmitting}
                        onClick={() => copyText(String(activeIntent.amount), "Đã sao chép số tiền thanh toán.")}
                        type="button"
                      >
                        Sao chép số tiền
                      </button>
                      <button
                        className="apg-btn-secondary"
                        disabled={isSubmitting}
                        onClick={() => copyText(activeIntent.transferContent, "Đã sao chép nội dung chuyển khoản.")}
                        type="button"
                      >
                        Sao chép nội dung
                      </button>
                      {canManage && canCancelIntent(activeIntent) ? (
                        <button
                          className="apg-btn-secondary border-rose-200 text-rose-700 hover:bg-rose-50"
                          disabled={isSubmitting}
                          onClick={() => handleCancelIntent(activeIntent.id)}
                          type="button"
                        >
                          {isSubmitting ? "Đang xử lý..." : "Hủy QR hiện tại"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-5 py-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-lg font-semibold text-[var(--apg-aviation-navy-deep)]">Chưa có QR payOS đang hiệu lực</div>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--apg-text-secondary)]">
                      Khi tạo QR, hệ thống sẽ chốt đúng công nợ hiện tại là <strong>{formatCurrency(balance, currency)}</strong>{" "}
                      và gắn vào booking để webhook có thể đối soát tự động.
                    </p>
                  </div>

                  {canManage ? (
                    <button
                      className="apg-btn-primary"
                      disabled={isSubmitting || balance <= 0}
                      onClick={handleCreateIntent}
                      type="button"
                    >
                      {isSubmitting ? "Đang tạo QR..." : "Tạo QR payOS"}
                    </button>
                  ) : (
                    <span className="rounded-full border border-[var(--apg-border-default)] bg-white px-3 py-2 text-sm text-[var(--apg-text-secondary)]">
                      Read-only
                    </span>
                  )}
                </div>
              </div>
            )}

            {actionState ? (
              <div
                className={`rounded-[18px] border px-4 py-3 text-sm font-medium ${
                  actionState.tone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {actionState.message}
              </div>
            ) : null}

            {webhookEvents.length > 0 ? (
              <div className="overflow-hidden rounded-[24px] border border-[var(--apg-border-default)] bg-white shadow-sm">
                <div className="border-b border-[var(--apg-border-default)] px-4 py-4">
                  <div className="text-sm font-semibold text-[var(--apg-aviation-navy-deep)]">Webhook &amp; đối soát</div>
                </div>

                <div className="grid gap-3 p-4">
                  {webhookEvents.map((event) => (
                    <article key={event.id} className="rounded-[20px] border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold text-[var(--apg-aviation-navy-deep)]">#{event.providerOrderCode}</div>
                          <div className="mt-1 text-xs text-[var(--apg-text-secondary)]">
                            {formatDateTime(event.createdAt)} · {formatCurrency(event.amount, currency)}
                          </div>
                        </div>

                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${webhookStatusClassName(event.status)}`}>
                          {webhookStatusLabel(event.status)}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm text-[var(--apg-text-secondary)] md:grid-cols-2">
                        <div>
                          Reference: <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">{event.reference || "-"}</span>
                        </div>
                        <div>
                          Payment record: <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">{event.paymentId || "Chưa tạo"}</span>
                        </div>
                      </div>

                      {event.manualReviewReason ? (
                        <div className="mt-3 rounded-[16px] border border-orange-200 bg-white px-3 py-3 text-sm text-orange-700">
                          Lý do manual review: <strong>{event.manualReviewReason}</strong>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {notificationJobs.length > 0 ? (
              <div className="overflow-hidden rounded-[24px] border border-[var(--apg-border-default)] bg-white shadow-sm">
                <div className="border-b border-[var(--apg-border-default)] px-4 py-4">
                  <div className="text-sm font-semibold text-[var(--apg-aviation-navy-deep)]">Automation queue</div>
                </div>

                <div className="grid gap-3 p-4">
                  {notificationJobs.map((job) => (
                    <article key={job.id} className="rounded-[20px] border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{jobTypeLabel(job.type)}</div>
                          <div className="mt-1 text-xs text-[var(--apg-text-secondary)]">
                            Lên lịch: {formatDateTime(job.scheduledAt)} · attempts {job.attempts}/{job.maxAttempts}
                          </div>
                        </div>

                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${jobStatusClassName(job.status)}`}>
                          {jobStatusLabel(job.status)}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm text-[var(--apg-text-secondary)] md:grid-cols-2">
                        <div>
                          Kênh: <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">{job.channel}</span>
                        </div>
                        <div>
                          Đã gửi: <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">{formatDateTime(job.sentAt)}</span>
                        </div>
                      </div>

                      {job.lastError ? (
                        <div className="mt-3 rounded-[16px] border border-slate-200 bg-white px-3 py-3 text-sm text-[var(--apg-text-secondary)]">
                          Ghi chú hệ thống: <strong>{job.lastError}</strong>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {paymentIntents.length === 0 ? null : (
              <div className="overflow-hidden rounded-[24px] border border-[var(--apg-border-default)] bg-white shadow-sm">
                <div className="border-b border-[var(--apg-border-default)] px-4 py-4">
                  <div className="text-sm font-semibold text-[var(--apg-aviation-navy-deep)]">Lịch sử QR payOS</div>
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="apg-admin-table min-w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="px-5 py-4 font-semibold">Order code</th>
                        <th className="px-4 py-4 font-semibold">Số tiền</th>
                        <th className="px-4 py-4 font-semibold">Trạng thái</th>
                        <th className="px-4 py-4 font-semibold">Hết hạn</th>
                        <th className="px-4 py-4 font-semibold">Tạo bởi</th>
                        <th className="px-5 py-4 font-semibold">Đối soát</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentIntents.map((intent) => {
                        const status = effectiveStatus(intent);

                        return (
                          <tr key={intent.id} className="border-t border-[var(--apg-border-default)] align-top">
                            <td className="px-5 py-4">
                              <div className="font-semibold text-[var(--apg-aviation-navy-deep)]">#{intent.providerOrderCode}</div>
                              <div className="mt-1 text-xs text-[var(--apg-text-secondary)]">{intent.paymentLinkId || "Chưa có paymentLinkId"}</div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="apg-tabular font-semibold text-[var(--apg-aviation-navy-deep)]">
                                {formatCurrency(intent.amount, intent.currency)}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${intentStatusClassName(status)}`}>
                                {intentStatusLabel(status)}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-[var(--apg-aviation-navy-deep)]">{formatDateTime(intent.expiresAt)}</td>
                            <td className="px-4 py-4">
                              <div className="font-medium text-[var(--apg-aviation-navy-deep)]">{intent.createdBy?.fullName || "-"}</div>
                              <div className="mt-1 text-xs text-[var(--apg-text-secondary)]">{intent.createdBy?.email || "-"}</div>
                            </td>
                            <td className="px-5 py-4 text-[var(--apg-text-secondary)]">
                              {intent.bankTransactions.length > 0
                                ? `${intent.bankTransactions.length} webhook`
                                : intent.payments.length > 0
                                  ? `${intent.payments.length} payment`
                                  : "Chưa có đối soát"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 p-4 md:hidden">
                  {paymentIntents.map((intent) => {
                    const status = effectiveStatus(intent);

                    return (
                      <article key={intent.id} className="rounded-[20px] border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-base font-semibold text-[var(--apg-aviation-navy-deep)]">#{intent.providerOrderCode}</div>
                            <div className="mt-1 text-xs text-[var(--apg-text-secondary)]">{intent.paymentLinkId || "Chưa có paymentLinkId"}</div>
                          </div>
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${intentStatusClassName(status)}`}>
                            {intentStatusLabel(status)}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 text-sm text-[var(--apg-text-secondary)]">
                          <div>
                            Số tiền:{" "}
                            <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">
                              {formatCurrency(intent.amount, intent.currency)}
                            </span>
                          </div>
                          <div>
                            Hết hạn:{" "}
                            <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">
                              {formatDateTime(intent.expiresAt)}
                            </span>
                          </div>
                          <div>
                            Đối soát:{" "}
                            <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">
                              {intent.bankTransactions.length > 0
                                ? `${intent.bankTransactions.length} webhook`
                                : intent.payments.length > 0
                                  ? `${intent.payments.length} payment`
                                  : "Chưa có"}
                            </span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-3">
            <div className="apg-admin-stat px-4 py-4">
              <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Số dư cần thu</div>
              <div className="mt-3 apg-tabular text-3xl font-semibold text-[var(--apg-aviation-navy-deep)]">
                {formatCurrency(balance, currency)}
              </div>
              <div className="mt-1 text-sm text-[var(--apg-text-secondary)]">{currency} còn lại trước khi booking có thể issue.</div>
            </div>

            <div className="apg-admin-stat px-4 py-4">
              <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Trạng thái payment ops</div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--apg-text-secondary)]">
                <li>{activeIntent ? "Đang có 1 QR active" : "Chưa có QR active"}</li>
                <li>{manualReviewCount > 0 ? `${manualReviewCount} webhook cần xử lý tay` : "Chưa có manual review"}</li>
                <li>{pendingJobCount > 0 ? `${pendingJobCount} email/reminder chờ gửi` : "Không có job đang chờ"}</li>
              </ul>
            </div>

            <div className="apg-admin-stat px-4 py-4">
              <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Nguyên tắc gate này</div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--apg-text-secondary)]">
                <li>Mỗi thời điểm chỉ nên có một QR payOS active cho một booking.</li>
                <li>Nếu balance đổi, hệ thống sẽ không gửi nhắc thanh toán trên QR cũ nữa.</li>
                <li>Webhook chuyển dư được đưa vào manual review thay vì auto match.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
