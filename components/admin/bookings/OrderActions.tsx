"use client";

import type { BookingStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";

import { toneVars } from "@/lib/admin/ui/tones";

// HANDOFF Phần J.3 — bảng thao tác đơn ở màn chi tiết (parity actBtn/actions file thiết kế,
// design JS 851-867). Chỉ render nút có endpoint thật + đúng quyền để tránh nút "chết";
// các nút thông báo (Zalo/ZNS) trong bản thiết kế chưa có API nên không hiển thị ở đây.

type ButtonKind = "primary" | "danger" | "ghost";
type FormMode = "cannot-issue" | "refund-request" | "cancel";

interface OrderActionsPermissions {
  issue: boolean;
  queueAction: boolean;
  refundConfirm: boolean;
  handoff: boolean;
  cancel: boolean;
}

interface OrderActionsProps {
  bookingId: string;
  status: BookingStatus;
  alreadyHandedOff: boolean;
  totalPaid: number;
  permissions: OrderActionsPermissions;
}

interface ActionDef {
  key: string;
  label: string;
  kind: ButtonKind;
  onClick: () => void;
}

const CANNOT_ISSUE_REASONS = [
  { value: "NO_SEAT", label: "Hết chỗ hạng đã đặt" },
  { value: "PRICE_INCREASED", label: "Giá đã tăng" },
  { value: "SCHEDULE_CHANGE", label: "Đổi lịch bay" },
  { value: "AIRLINE_REJECT", label: "Hãng từ chối" },
  { value: "DUPLICATE", label: "Đơn trùng" },
  { value: "OTHER", label: "Khác" },
] as const;

const CANCEL_REASONS = [
  { value: "CUSTOMER_REQUEST", label: "Khách yêu cầu" },
  { value: "PAYMENT_FAIL", label: "Thanh toán lỗi" },
  { value: "AIRLINE_CANCEL", label: "Hãng huỷ chuyến" },
  { value: "DUPLICATE", label: "Đơn trùng" },
  { value: "OTHER", label: "Khác" },
] as const;

const BTN_BASE =
  "rounded-[8px] px-[14px] py-[11px] text-[13px] font-semibold leading-none w-full transition disabled:cursor-not-allowed disabled:opacity-50";
const FIELD =
  "w-full rounded-[8px] border border-[var(--line)] bg-[var(--surface)] px-[12px] py-[9px] text-[13px] text-[var(--ink)] outline-none transition focus:border-[var(--line-strong)]";
const FIELD_LABEL = "mb-[6px] block text-[11px] font-semibold uppercase tracking-[1px] text-[var(--ink-faint)]";

function buttonStyle(kind: ButtonKind): CSSProperties {
  const rust = toneVars("rust");
  if (kind === "primary") {
    return { border: "1px solid var(--rust)", background: "var(--rust)", color: "#F5F1EA" };
  }
  if (kind === "danger") {
    return { border: `1px solid ${rust.bd}`, background: rust.bg, color: rust.fg };
  }
  return { border: "1px solid var(--line-strong)", background: "transparent", color: "var(--ink-soft)" };
}

function messageForError(status: number, data: { error?: string; message?: string }): string {
  if (status === 403) return "Bạn không có quyền thực hiện thao tác này.";
  switch (data.error) {
    case "INVALID_STATUS":
      return data.message ?? "Trạng thái đơn không cho phép thao tác này.";
    case "INSUFFICIENT_PAYMENT":
      return "Đơn còn công nợ nên chưa thể xuất vé.";
    case "NO_VALID_PNR":
      return "Đơn chưa có PNR hợp lệ để xuất vé.";
    case "REFUND_EXCEEDS_PAID":
      return "Số tiền hoàn vượt quá số tiền đã thu.";
    case "ALREADY_CLAIMED":
      return "Đơn đã được người khác nhận xử lý.";
    case "BOOKING_NOT_FOUND":
      return "Không tìm thấy đơn.";
    case "VALIDATION_ERROR":
      return data.message ?? "Dữ liệu gửi lên không hợp lệ.";
    default:
      return data.message ?? "Có lỗi xảy ra, vui lòng thử lại.";
  }
}

export function OrderActions({ bookingId, status, alreadyHandedOff, totalPaid, permissions }: OrderActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<FormMode | null>(null);

  const [cannotIssueReason, setCannotIssueReason] = useState<string>(CANNOT_ISSUE_REASONS[0].value);
  const [cannotIssueDetail, setCannotIssueDetail] = useState("");
  const [refundAmount, setRefundAmount] = useState<string>(String(totalPaid || ""));
  const [refundReason, setRefundReason] = useState("");
  const [cancelReason, setCancelReason] = useState<string>(CANCEL_REASONS[0].value);
  const [cancelDetail, setCancelDetail] = useState("");

  async function submit(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        setError(messageForError(res.status, data));
        return;
      }

      setMode(null);
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ, vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  function closeForm() {
    setMode(null);
    setError(null);
  }

  const actions: ActionDef[] = [];
  if (status === "PAID" || status === "TICKETING") {
    if (permissions.issue) {
      actions.push({ key: "issue", label: "Xác nhận đã xuất vé", kind: "primary", onClick: () => submit("issue", {}) });
    }
    if (permissions.queueAction) {
      actions.push({ key: "cannot-issue", label: "Không xuất được", kind: "danger", onClick: () => setMode("cannot-issue") });
    }
  } else if (status === "CANNOT_ISSUE") {
    if (permissions.queueAction) {
      actions.push({ key: "refund-request", label: "Tạo yêu cầu hoàn tiền", kind: "primary", onClick: () => setMode("refund-request") });
    }
  } else if (status === "REFUND_REQUIRED") {
    if (permissions.refundConfirm) {
      actions.push({
        key: "refund-confirm",
        label: "Xác nhận đã hoàn tiền",
        kind: "primary",
        onClick: () => submit("refund/confirm", { method: "BANK" }),
      });
    }
  } else if (status === "HELD" || status === "PENDING_PAYMENT" || status === "QUOTED" || status === "PAYMENT_FAILED") {
    if (permissions.cancel) {
      actions.push({ key: "cancel", label: "Huỷ đơn", kind: "ghost", onClick: () => setMode("cancel") });
    }
  }

  if ((status === "TICKETED" || status === "REFUNDED" || status === "CANCELLED") && permissions.handoff && !alreadyHandedOff) {
    actions.push({ key: "handoff", label: "Bàn giao sang RMS", kind: "ghost", onClick: () => submit("handoff", {}) });
  }

  const cannotIssueValid = cannotIssueReason !== "OTHER" || cannotIssueDetail.trim().length >= 10;
  const refundAmountNum = Number(refundAmount);
  const refundValid = Number.isInteger(refundAmountNum) && refundAmountNum > 0 && refundReason.trim().length >= 3;
  const cancelValid = cancelReason !== "OTHER" || cancelDetail.trim().length >= 10;

  return (
    <div>
      {error ? (
        <div
          className="mb-3 rounded-[8px] border px-[12px] py-[9px] text-[12px] font-medium"
          style={{ color: toneVars("red").fg, background: toneVars("red").bg, borderColor: toneVars("red").bd }}
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {mode === "cannot-issue" ? (
        <div className="flex flex-col gap-[12px]">
          <div className="ofly-eyebrow">Báo không xuất được</div>
          <div>
            <label className={FIELD_LABEL} htmlFor="ci-reason">
              Lý do
            </label>
            <select
              id="ci-reason"
              className={FIELD}
              value={cannotIssueReason}
              onChange={(event) => setCannotIssueReason(event.target.value)}
            >
              {CANNOT_ISSUE_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={FIELD_LABEL} htmlFor="ci-detail">
              Chi tiết {cannotIssueReason === "OTHER" ? "(bắt buộc, tối thiểu 10 ký tự)" : "(tuỳ chọn)"}
            </label>
            <textarea
              id="ci-detail"
              className={`${FIELD} min-h-[72px] resize-none`}
              value={cannotIssueDetail}
              onChange={(event) => setCannotIssueDetail(event.target.value)}
              placeholder="Mô tả ngắn gọn lý do không xuất được vé…"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={BTN_BASE}
              style={buttonStyle("danger")}
              disabled={busy || !cannotIssueValid}
              onClick={() =>
                submit("cannot-issue", {
                  reason: cannotIssueReason,
                  detail: cannotIssueDetail.trim() || undefined,
                })
              }
            >
              Xác nhận
            </button>
            <button type="button" className={BTN_BASE} style={buttonStyle("ghost")} disabled={busy} onClick={closeForm}>
              Quay lại
            </button>
          </div>
        </div>
      ) : mode === "refund-request" ? (
        <div className="flex flex-col gap-[12px]">
          <div className="ofly-eyebrow">Tạo yêu cầu hoàn tiền</div>
          <div>
            <label className={FIELD_LABEL} htmlFor="rf-amount">
              Số tiền hoàn (₫)
            </label>
            <input
              id="rf-amount"
              type="number"
              min={1}
              className={FIELD}
              value={refundAmount}
              onChange={(event) => setRefundAmount(event.target.value)}
            />
          </div>
          <div>
            <label className={FIELD_LABEL} htmlFor="rf-reason">
              Lý do hoàn (tối thiểu 3 ký tự)
            </label>
            <input
              id="rf-reason"
              className={FIELD}
              value={refundReason}
              onChange={(event) => setRefundReason(event.target.value)}
              placeholder="VD: Không xuất được vé do hết chỗ"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={BTN_BASE}
              style={buttonStyle("primary")}
              disabled={busy || !refundValid}
              onClick={() => submit("refund/request", { amount: refundAmountNum, reason: refundReason.trim() })}
            >
              Gửi yêu cầu
            </button>
            <button type="button" className={BTN_BASE} style={buttonStyle("ghost")} disabled={busy} onClick={closeForm}>
              Quay lại
            </button>
          </div>
        </div>
      ) : mode === "cancel" ? (
        <div className="flex flex-col gap-[12px]">
          <div className="ofly-eyebrow">Huỷ đơn</div>
          <div>
            <label className={FIELD_LABEL} htmlFor="cancel-reason">
              Lý do huỷ
            </label>
            <select
              id="cancel-reason"
              className={FIELD}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
            >
              {CANCEL_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={FIELD_LABEL} htmlFor="cancel-detail">
              Chi tiết {cancelReason === "OTHER" ? "(bắt buộc, tối thiểu 10 ký tự)" : "(tuỳ chọn)"}
            </label>
            <textarea
              id="cancel-detail"
              className={`${FIELD} min-h-[72px] resize-none`}
              value={cancelDetail}
              onChange={(event) => setCancelDetail(event.target.value)}
              placeholder="Mô tả ngắn gọn lý do huỷ đơn…"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={BTN_BASE}
              style={buttonStyle("danger")}
              disabled={busy || !cancelValid}
              onClick={() =>
                submit("cancel", {
                  reason: cancelReason,
                  detail: cancelDetail.trim() || undefined,
                  markRefund: false,
                })
              }
            >
              Xác nhận huỷ
            </button>
            <button type="button" className={BTN_BASE} style={buttonStyle("ghost")} disabled={busy} onClick={closeForm}>
              Quay lại
            </button>
          </div>
        </div>
      ) : actions.length > 0 ? (
        <div className="flex flex-col gap-[9px]">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              className={BTN_BASE}
              style={buttonStyle(action.kind)}
              disabled={busy}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-[12px] italic text-[var(--ink-soft)]">Không có thao tác khả dụng ở bước này.</div>
      )}
    </div>
  );
}
