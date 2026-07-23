import { Clock } from "lucide-react";

import { MiniChip } from "@/components/admin/ui/Chip";
import { SectionTitle } from "@/components/admin/ui/PageHead";
import { Eyebrow, Panel } from "@/components/admin/ui/Panel";
import type { AdminBookingTimelineEvent } from "@/lib/bookings/admin";

interface BookingTimelineProps {
  timeline: AdminBookingTimelineEvent[];
  fallbackActorId?: string | null;
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(value);
}

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function resolveActorId(event: AdminBookingTimelineEvent, fallbackActorId?: string | null): string | null {
  const payload = recordOf(event.payload);

  if (typeof payload.actorId === "string" && payload.actorId.trim()) {
    return payload.actorId;
  }

  return fallbackActorId ?? null;
}

function resolveNote(event: AdminBookingTimelineEvent): string | null {
  const payload = recordOf(event.payload);
  const candidates = [payload.notes, payload.note, payload.detail, payload.reason];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

// Ô "nhãn nhỏ · giá trị" trong thẻ sự kiện.
function EventMeta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase leading-none tracking-[1.2px] text-[var(--ink3)]">{label}</div>
      <div className={`mt-[6px] break-all text-[12.5px] font-medium text-[var(--ink)] ${mono ? "ofly-num" : ""}`}>{value}</div>
    </div>
  );
}

export function BookingTimeline({ timeline, fallbackActorId }: BookingTimelineProps) {
  if (timeline.length === 0) {
    return (
      <Panel className="px-[24px] py-[38px]">
        <div className="mx-auto max-w-[520px] text-center">
          <div
            className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-[12px]"
            style={{ background: "var(--rustTint)", color: "var(--rust)" }}
          >
            <Clock size={24} strokeWidth={1.5} />
          </div>
          <h3 className="ofly-serif m-0 mt-4 text-[21px] font-medium tracking-[-0.6px] text-[var(--ink)]">
            Timeline booking đang trống
          </h3>
          <p className="m-0 mt-[10px] text-[13px] leading-[1.6] text-[var(--ink3)]">
            Khi hold, issue, cancel hoặc ghi nhận thanh toán, các sự kiện nghiệp vụ sẽ xuất hiện tại đây theo đúng thứ tự thời gian.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel padded={false} className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[var(--line)] bg-[var(--paper2)] px-[20px] py-[16px] lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Eyebrow>Dòng thời gian vận hành</Eyebrow>
          <SectionTitle className="mt-[8px]">Dòng thời gian xử lý booking</SectionTitle>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MiniChip tone="rust">{timeline.length} sự kiện</MiniChip>
          <MiniChip tone="muted">Sắp xếp từ cũ đến mới</MiniChip>
        </div>
      </div>

      <div className="px-[20px] py-[18px]">
        {/* Đường rail dọc nối các mốc — màu --line để chìm dưới nội dung. */}
        <div className="relative flex flex-col gap-3 before:absolute before:bottom-0 before:left-[5px] before:top-2 before:w-px before:bg-[var(--line)]">
          {timeline.map((event) => {
            const actorId = resolveActorId(event, fallbackActorId);
            const note = resolveNote(event);

            return (
              <article key={event.id} className="relative pl-[26px]">
                <span
                  className="absolute left-0 top-[20px] h-[11px] w-[11px] rounded-full border-2 border-[var(--paper)]"
                  style={{ background: "var(--rust)" }}
                  aria-hidden="true"
                />

                <div className="rounded-[12px] border border-[var(--line)] bg-[var(--paper2)] px-[16px] py-[14px]">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <MiniChip tone="muted">{event.eventType}</MiniChip>
                        <span className="text-[10px] font-semibold uppercase leading-none tracking-[1.2px] text-[var(--ink3)]">
                          {event.source}
                        </span>
                      </div>

                      <h4 className="ofly-serif m-0 mt-3 text-[18px] font-medium tracking-[-0.4px] text-[var(--ink)]">{event.title}</h4>

                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <EventMeta label="Thời điểm" value={formatDateTime(event.occurredAt)} mono />
                        <EventMeta label="PNR" value={event.pnr || "-"} mono />
                        <EventMeta label="Actor" value={actorId || "Chưa ghi nhận"} mono />
                      </div>

                      {note ? <p className="m-0 mt-4 text-[12.5px] leading-[1.6] text-[var(--ink2)]">{note}</p> : null}
                    </div>

                    <details className="min-w-0 overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--paper)] xl:w-[340px]">
                      <summary className="cursor-pointer px-[14px] py-[10px] text-[12.5px] font-semibold text-[var(--ink2)]">
                        Xem payload JSON
                      </summary>
                      <pre className="ofly-mono max-h-[280px] overflow-auto border-t border-[var(--line)] px-[14px] py-[12px] text-[11.5px] leading-[1.7] text-[var(--ink2)]">
                        {stringifyJson(event.payload)}
                      </pre>
                    </details>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
