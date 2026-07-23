"use client";

import type { BookingStatus } from "@prisma/client";
import { TicketCheck, TriangleAlert, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Btn, ButtonLink } from "@/components/admin/ui/Btn";
import { StatusChip } from "@/components/admin/ui/Chip";
import { Eyebrow, Panel } from "@/components/admin/ui/Panel";
import { formatVnd, formatRoute } from "@/lib/admin/ui/format";
import { toneVars, type Tone } from "@/lib/admin/ui/tones";
import type { TicketingQueueRecord } from "@/lib/bookings/ticketingQueue";

// HANDOFF Phần J.3 — hàng đợi xuất vé. Bố cục/handlers parity với file thiết kế (queueRows):
// thanh SLA bên trái theo tone, cột PNR/KHÁCH/SỐ TIỀN/SLA + nút "Nhận xử lý"/"Xác nhận xuất".
// SLA tính thuần từ props (minutesToSla + paidConfirmedAt/slaDueAt) nên không lệch khi hydrate.

interface QueueListProps {
  items: TicketingQueueRecord[];
  currentUserName: string;
}

interface SlaView {
  text: string;
  tone: Tone;
  barPct: number;
  elapsedText: string;
  /** Gấp → chấm tròn nhấp nháy (mẫu Countdown của Manager). */
  urgent: boolean;
  /** Chuỗi dạng đồng hồ → chữ mono; câu mô tả người xử lý → chữ sans. */
  mono: boolean;
}

function computeSla(item: TicketingQueueRecord): SlaView {
  if (item.status === "TICKETING") {
    return {
      text: item.assignedToName ? `Đang xử lý · ${item.assignedToName}` : "Đang xử lý",
      tone: "info",
      barPct: 65,
      elapsedText: "",
      urgent: false,
      mono: false,
    };
  }

  const minutes = item.minutesToSla;
  if (minutes === null) {
    return { text: "Chưa có hạn SLA", tone: "muted", barPct: 0, elapsedText: "", urgent: false, mono: false };
  }

  let barPct = 0;
  let elapsedText = "";
  if (item.paidConfirmedAt && item.slaDueAt) {
    const windowMin = (new Date(item.slaDueAt).getTime() - new Date(item.paidConfirmedAt).getTime()) / 60_000;
    if (windowMin > 0) {
      const elapsed = windowMin - minutes;
      barPct = Math.max(0, Math.min(100, Math.round((elapsed / windowMin) * 100)));
      elapsedText = `${Math.max(0, Math.round(elapsed))}p trước`;
    }
  }

  // Ngưỡng màu theo Countdown của Manager: đỏ khi <10 phút (hoặc đã trễ), vàng khi <30 phút.
  if (minutes < 0) {
    return { text: `Quá SLA +${Math.abs(minutes)}p`, tone: "red", barPct: 100, elapsedText, urgent: true, mono: true };
  }
  if (minutes < 10) {
    return { text: `Còn ${minutes}p`, tone: "red", barPct, elapsedText, urgent: true, mono: true };
  }
  if (minutes < 30) {
    return { text: `Còn ${minutes}p`, tone: "warn", barPct, elapsedText, urgent: false, mono: true };
  }
  return { text: `Còn ${minutes}p`, tone: "ok", barPct, elapsedText, urgent: false, mono: true };
}

function messageForError(status: number, data: { error?: string; message?: string }): string {
  if (status === 403) return "Bạn không có quyền thực hiện thao tác này.";
  switch (data.error) {
    case "ALREADY_CLAIMED":
      return "Đơn đã được người khác nhận xử lý.";
    case "INVALID_STATUS":
      return data.message ?? "Trạng thái đơn không cho phép thao tác này.";
    case "INSUFFICIENT_PAYMENT":
      return "Đơn còn công nợ nên chưa thể xuất vé.";
    case "NO_VALID_PNR":
      return "Đơn chưa có PNR hợp lệ để xuất vé.";
    case "BOOKING_NOT_FOUND":
      return "Không tìm thấy đơn.";
    case "VALIDATION_ERROR":
      return "Dữ liệu gửi lên không hợp lệ.";
    default:
      return "Có lỗi xảy ra, vui lòng thử lại.";
  }
}

export function QueueList({ items, currentUserName }: QueueListProps) {
  const router = useRouter();
  const [rows, setRows] = useState<TicketingQueueRecord[]>(items);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function mutate(id: string, action: "claim" | "issue") {
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${id}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        setError(messageForError(res.status, data));
        return;
      }

      if (action === "claim") {
        setRows((prev) =>
          prev.map((row) =>
            row.id === id
              ? { ...row, status: "TICKETING", assignedToId: row.assignedToId ?? "me", assignedToName: currentUserName }
              : row,
          ),
        );
      } else {
        // Đã xuất vé → đơn rời hàng đợi.
        setRows((prev) => prev.filter((row) => row.id !== id));
      }
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ, vui lòng thử lại.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      {error ? (
        <div
          className="mb-3 flex items-center gap-[10px] rounded-[10px] border px-[14px] py-[10px] text-[12.5px] font-medium"
          style={{ color: toneVars("red").fg, background: toneVars("red").bg, borderColor: toneVars("red").bd }}
          role="alert"
        >
          <TriangleAlert size={16} strokeWidth={1.9} className="flex-none" aria-hidden="true" />
          {error}
        </div>
      ) : null}

      <Panel padded={false} className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="ofly-serif px-[18px] py-[54px] text-center text-[16px] italic text-[var(--ink3)]">
            Không còn đơn nào chờ xuất. Sạch sẽ.
          </div>
        ) : (
          rows.map((item) => {
            const sla = computeSla(item);
            const isTicketing = item.status === "TICKETING";
            const busy = pendingId === item.id;

            return (
              <div
                key={item.id}
                className="relative flex flex-wrap items-center gap-x-[18px] gap-y-[12px] border-b border-[var(--line)] py-[14px] pl-[20px] pr-[18px] transition-colors duration-[120ms] last:border-b-0 hover:bg-[var(--paper2)]"
              >
                {/* Thanh SLA bám mép trái: đặt absolute để vẫn phủ hết chiều cao khi hàng xuống dòng ở mobile. */}
                <span
                  className="absolute bottom-0 left-0 top-0 w-[3px]"
                  style={{ background: toneVars(sla.tone).solid }}
                  aria-hidden="true"
                />

                <div className="min-w-[190px] flex-1">
                  <div className="flex flex-wrap items-center gap-[10px]">
                    <span className="ofly-num whitespace-nowrap text-[15px] font-semibold tracking-[0.5px] text-[var(--ink)]">
                      {formatRoute(item.route)}
                    </span>
                    <StatusChip status={item.status as BookingStatus} />
                  </div>
                  <div className="mt-[5px] flex min-w-0 items-center gap-[6px] text-[12px] text-[var(--ink3)]">
                    <span className="truncate">{item.airline ?? "—"}</span>
                    <span aria-hidden="true">·</span>
                    <span className="ofly-num text-[11.5px]">{item.orderCode}</span>
                  </div>
                </div>

                <div className="w-[92px] flex-none">
                  <Eyebrow className="mb-[5px] tracking-[1.4px]">PNR</Eyebrow>
                  <div className="ofly-num text-[13px] font-semibold text-[var(--rust)]">{item.pnr ?? "—"}</div>
                </div>

                <div className="w-[76px] flex-none">
                  <Eyebrow className="mb-[5px] tracking-[1.4px]">KHÁCH</Eyebrow>
                  <div className="text-[13px] text-[var(--ink2)]">
                    <span className="ofly-num font-semibold text-[var(--ink)]">{item.passengerCount}</span> khách
                  </div>
                </div>

                <div className="w-[124px] flex-none">
                  <Eyebrow className="mb-[5px] tracking-[1.4px]">SỐ TIỀN</Eyebrow>
                  <div className="ofly-num text-[13.5px] font-semibold text-[var(--ink)]">
                    {formatVnd(item.sellPrice)}
                  </div>
                </div>

                <div className="w-[162px] flex-none">
                  <div className="mb-[7px] flex items-center justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-[7px]">
                      <span
                        className={`h-[7px] w-[7px] flex-none rounded-full ${sla.urgent ? "ofly-pulse" : ""}`}
                        style={{ background: toneVars(sla.tone).solid }}
                        aria-hidden="true"
                      />
                      <span
                        className={`truncate text-[12.5px] font-semibold ${sla.mono ? "ofly-num" : ""}`}
                        style={{ color: toneVars(sla.tone).fg }}
                      >
                        {sla.text}
                      </span>
                    </span>
                    {sla.elapsedText ? (
                      <span className="ofly-num whitespace-nowrap text-[11px] text-[var(--ink4)]">
                        {sla.elapsedText}
                      </span>
                    ) : null}
                  </div>
                  <div className="h-[3px] overflow-hidden rounded-full bg-[var(--paper2)]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${sla.barPct}%`, background: toneVars(sla.tone).solid }}
                    />
                  </div>
                </div>

                <div className="ml-auto flex flex-none items-center justify-end gap-2">
                  {!isTicketing ? (
                    <Btn
                      variant="rust"
                      size="sm"
                      disabled={busy}
                      onClick={() => mutate(item.id, "claim")}
                      icon={<UserCheck size={14} strokeWidth={1.9} />}
                    >
                      Nhận xử lý
                    </Btn>
                  ) : (
                    <Btn
                      variant="rust"
                      size="sm"
                      disabled={busy}
                      onClick={() => mutate(item.id, "issue")}
                      icon={<TicketCheck size={14} strokeWidth={1.9} />}
                    >
                      Xác nhận xuất
                    </Btn>
                  )}
                  <ButtonLink variant="ghost" size="sm" href={`/admin/bookings/${item.id}`}>
                    Chi tiết
                  </ButtonLink>
                </div>
              </div>
            );
          })
        )}
      </Panel>
    </div>
  );
}
