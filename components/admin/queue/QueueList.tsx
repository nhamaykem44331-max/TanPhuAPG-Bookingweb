"use client";

import type { BookingStatus } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Chip } from "@/components/admin/ui/Chip";
import { formatVnd, formatRoute } from "@/lib/admin/ui/format";
import { statusMeta } from "@/lib/admin/ui/status";
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
}

function computeSla(item: TicketingQueueRecord): SlaView {
  if (item.status === "TICKETING") {
    return {
      text: item.assignedToName ? `Đang xử lý · ${item.assignedToName}` : "Đang xử lý",
      tone: "info",
      barPct: 65,
      elapsedText: "",
    };
  }

  const minutes = item.minutesToSla;
  if (minutes === null) {
    return { text: "Chưa có hạn SLA", tone: "muted", barPct: 0, elapsedText: "" };
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

  if (minutes < 0) {
    return { text: `Quá SLA +${Math.abs(minutes)}p`, tone: "rust", barPct: 100, elapsedText };
  }
  if (minutes <= 10) {
    return { text: `Còn ${minutes}p`, tone: "warn", barPct, elapsedText };
  }
  return { text: `Còn ${minutes}p`, tone: "ok", barPct, elapsedText };
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

const RUST_BUTTON =
  "rounded-[7px] border border-[var(--rust)] bg-[var(--rust)] px-[14px] py-[9px] text-[12px] font-semibold text-[#F5F1EA] whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-50";
const GHOST_BUTTON =
  "rounded-[7px] border border-[var(--line-strong)] bg-transparent px-[14px] py-[9px] text-[12px] font-medium text-[var(--ink-soft)] whitespace-nowrap transition hover:border-[var(--ink)] hover:text-[var(--ink)]";

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
          className="mb-3 rounded-[8px] border px-[14px] py-[10px] text-[12px] font-medium"
          style={{ color: toneVars("red").fg, background: toneVars("red").bg, borderColor: toneVars("red").bd }}
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]">
        {rows.length === 0 ? (
          <div className="ofly-serif px-12 py-12 text-center text-[18px] italic text-[var(--ink-soft)]">
            Không còn đơn nào chờ xuất. Sạch sẽ.
          </div>
        ) : (
          rows.map((item) => {
            const sla = computeSla(item);
            const meta = statusMeta(item.status as BookingStatus);
            const isTicketing = item.status === "TICKETING";
            const busy = pendingId === item.id;

            return (
              <div
                key={item.id}
                className="relative flex items-center gap-[18px] border-b border-[var(--line)] py-[16px] pr-[20px] last:border-b-0"
              >
                <div className="w-[3px] self-stretch" style={{ background: toneVars(sla.tone).solid }} aria-hidden="true" />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-[10px]">
                    <span className="ofly-serif whitespace-nowrap text-[18px] font-medium tracking-[0.5px]">
                      {formatRoute(item.route)}
                    </span>
                    <Chip tone={meta.tone}>{meta.label}</Chip>
                  </div>
                  <div className="mt-[5px] truncate text-[12px] text-[var(--ink-soft)]">
                    {[item.airline ?? "—", item.orderCode].filter(Boolean).join(" · ")}
                  </div>
                </div>

                <div className="w-[88px] flex-none">
                  <div className="mb-[4px] text-[10px] font-semibold uppercase leading-none tracking-[1.5px] text-[var(--ink-faint)]">
                    PNR
                  </div>
                  <div className="ofly-sans text-[13px] font-semibold tracking-[1px] text-[var(--rust)]">
                    {item.pnr ?? "—"}
                  </div>
                </div>

                <div className="w-[80px] flex-none">
                  <div className="mb-[4px] text-[10px] font-semibold uppercase leading-none tracking-[1.5px] text-[var(--ink-faint)]">
                    KHÁCH
                  </div>
                  <div className="text-[13px] font-medium">{item.passengerCount} khách</div>
                </div>

                <div className="w-[120px] flex-none">
                  <div className="mb-[4px] text-[10px] font-semibold uppercase leading-none tracking-[1.5px] text-[var(--ink-faint)]">
                    SỐ TIỀN
                  </div>
                  <div className="ofly-serif text-[15px] font-medium">{formatVnd(item.sellPrice)}</div>
                </div>

                <div className="w-[158px] flex-none">
                  <div className="mb-[6px] flex items-center justify-between">
                    <span className="text-[12px] font-semibold" style={{ color: toneVars(sla.tone).fg }}>
                      {sla.text}
                    </span>
                    <span className="text-[11px] text-[var(--ink-faint)]">{sla.elapsedText}</span>
                  </div>
                  <div className="h-[4px] overflow-hidden rounded-[4px] bg-[var(--surface-2)]">
                    <div
                      className="h-full rounded-[4px]"
                      style={{ width: `${sla.barPct}%`, background: toneVars(sla.tone).solid }}
                    />
                  </div>
                </div>

                <div className="flex w-[200px] flex-none justify-end gap-2">
                  {!isTicketing ? (
                    <button type="button" className={RUST_BUTTON} disabled={busy} onClick={() => mutate(item.id, "claim")}>
                      Nhận xử lý
                    </button>
                  ) : (
                    <button type="button" className={RUST_BUTTON} disabled={busy} onClick={() => mutate(item.id, "issue")}>
                      Xác nhận xuất
                    </button>
                  )}
                  <Link className={GHOST_BUTTON} href={`/admin/bookings/${item.id}`}>
                    Chi tiết
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
