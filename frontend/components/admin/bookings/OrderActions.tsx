"use client";

import type { BookingStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Btn, type BtnVariant } from "@/components/admin/ui/Btn";
import { Field, Input, Select, Textarea } from "@/components/admin/ui/Field";
import { Eyebrow } from "@/components/admin/ui/Panel";
import { toneVars } from "@/lib/admin/ui/tones";

// HANDOFF Phần J.3 — bảng thao tác đơn ở màn chi tiết (parity actBtn/actions file thiết kế,
// design JS 851-867). Chỉ render nút có endpoint thật + đúng quyền để tránh nút "chết";
// các nút thông báo (Zalo/ZNS) trong bản thiết kế chưa có API nên không hiển thị ở đây.

type ButtonKind = "primary" | "danger" | "ghost";
type FormMode = "cannot-issue" | "refund-request" | "cancel";

// Skin Manager (§4): hành động chính là CTA gradient navy, phá huỷ là viền đỏ, còn lại ghost.
const KIND_VARIANT: Record<ButtonKind, BtnVariant> = {
  primary: "rust",
  danger: "danger",
  ghost: "ghost",
};

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
          className="mb-3 rounded-[10px] border px-[13px] py-[10px] text-[12px] font-medium leading-[1.45]"
          style={{ color: toneVars("red").fg, background: toneVars("red").bg, borderColor: toneVars("red").bd }}
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {mode === "cannot-issue" ? (
        <div className="flex flex-col gap-[13px]">
          <Eyebrow>Báo không xuất được</Eyebrow>
          <Field label="Lý do">
            <Select
              id="ci-reason"
              value={cannotIssueReason}
              onChange={(event) => setCannotIssueReason(event.target.value)}
            >
              {CANNOT_ISSUE_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`Chi tiết ${cannotIssueReason === "OTHER" ? "(bắt buộc, tối thiểu 10 ký tự)" : "(tuỳ chọn)"}`}>
            <Textarea
              id="ci-detail"
              className="min-h-[72px]"
              value={cannotIssueDetail}
              onChange={(event) => setCannotIssueDetail(event.target.value)}
              placeholder="Mô tả ngắn gọn lý do không xuất được vé…"
            />
          </Field>
          <div className="flex gap-2">
            <Btn
              variant="danger"
              size="sm"
              full
              disabled={busy || !cannotIssueValid}
              onClick={() =>
                submit("cannot-issue", {
                  reason: cannotIssueReason,
                  detail: cannotIssueDetail.trim() || undefined,
                })
              }
            >
              Xác nhận
            </Btn>
            <Btn variant="ghost" size="sm" full disabled={busy} onClick={closeForm}>
              Quay lại
            </Btn>
          </div>
        </div>
      ) : mode === "refund-request" ? (
        <div className="flex flex-col gap-[13px]">
          <Eyebrow>Tạo yêu cầu hoàn tiền</Eyebrow>
          <Field label="Số tiền hoàn (₫)">
            <Input
              id="rf-amount"
              type="number"
              min={1}
              mono
              value={refundAmount}
              onChange={(event) => setRefundAmount(event.target.value)}
            />
          </Field>
          <Field label="Lý do hoàn (tối thiểu 3 ký tự)">
            <Input
              id="rf-reason"
              value={refundReason}
              onChange={(event) => setRefundReason(event.target.value)}
              placeholder="VD: Không xuất được vé do hết chỗ"
            />
          </Field>
          <div className="flex gap-2">
            <Btn
              variant="rust"
              size="sm"
              full
              disabled={busy || !refundValid}
              onClick={() => submit("refund/request", { amount: refundAmountNum, reason: refundReason.trim() })}
            >
              Gửi yêu cầu
            </Btn>
            <Btn variant="ghost" size="sm" full disabled={busy} onClick={closeForm}>
              Quay lại
            </Btn>
          </div>
        </div>
      ) : mode === "cancel" ? (
        <div className="flex flex-col gap-[13px]">
          <Eyebrow>Huỷ đơn</Eyebrow>
          <Field label="Lý do huỷ">
            <Select id="cancel-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)}>
              {CANCEL_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`Chi tiết ${cancelReason === "OTHER" ? "(bắt buộc, tối thiểu 10 ký tự)" : "(tuỳ chọn)"}`}>
            <Textarea
              id="cancel-detail"
              className="min-h-[72px]"
              value={cancelDetail}
              onChange={(event) => setCancelDetail(event.target.value)}
              placeholder="Mô tả ngắn gọn lý do huỷ đơn…"
            />
          </Field>
          <div className="flex gap-2">
            <Btn
              variant="danger"
              size="sm"
              full
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
            </Btn>
            <Btn variant="ghost" size="sm" full disabled={busy} onClick={closeForm}>
              Quay lại
            </Btn>
          </div>
        </div>
      ) : actions.length > 0 ? (
        <div className="flex flex-col gap-[9px]">
          {actions.map((action) => (
            <Btn key={action.key} variant={KIND_VARIANT[action.kind]} full disabled={busy} onClick={action.onClick}>
              {action.label}
            </Btn>
          ))}
        </div>
      ) : (
        <div className="ofly-serif py-[6px] text-[13px] italic text-[var(--ink3)]">Không có thao tác khả dụng ở bước này.</div>
      )}
    </div>
  );
}
