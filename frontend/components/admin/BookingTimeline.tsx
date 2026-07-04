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

export function BookingTimeline({ timeline, fallbackActorId }: BookingTimelineProps) {
  if (timeline.length === 0) {
    return (
      <section className="apg-admin-sheet p-8">
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--apg-aviation-navy-soft)] text-[var(--apg-aviation-navy)]">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
              <path d="M12 6v6l4 2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </div>
          <h3 className="mt-4 text-xl font-semibold text-[var(--apg-aviation-navy-deep)]">Timeline booking đang trống</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--apg-text-secondary)]">
            Khi hold, issue, cancel hoặc ghi nhận thanh toán, các sự kiện nghiệp vụ sẽ xuất hiện tại đây theo đúng thứ tự thời gian.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="apg-admin-sheet overflow-hidden">
      <div className="border-b border-[var(--apg-border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(238,242,245,0.98))] px-5 py-4 lg:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="apg-eyebrow">Operations Timeline</p>
            <h3 className="mt-2 text-2xl font-semibold text-[var(--apg-aviation-navy-deep)]">Dòng thời gian xử lý booking</h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--apg-text-secondary)]">
            <span className="apg-chip">{timeline.length} sự kiện</span>
            <span className="apg-chip">Sắp xếp từ cũ đến mới</span>
          </div>
        </div>
      </div>

      <div className="p-5 lg:p-6">
        <div className="relative space-y-4 before:absolute before:bottom-0 before:left-[15px] before:top-2 before:w-px before:bg-[var(--apg-border-default)]">
          {timeline.map((event) => {
            const actorId = resolveActorId(event, fallbackActorId);
            const note = resolveNote(event);

            return (
              <article key={event.id} className="relative pl-10">
                <div className="absolute left-0 top-4 h-8 w-8 rounded-full border border-[var(--apg-border-default)] bg-white shadow-sm" />

                <div className="apg-admin-toolbar px-4 py-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[var(--apg-border-default)] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--apg-aviation-navy-deep)]">
                          {event.eventType}
                        </span>
                        <span className="text-xs uppercase tracking-[0.16em] text-[var(--apg-text-secondary)]">{event.source}</span>
                      </div>

                      <h4 className="mt-3 text-lg font-semibold text-[var(--apg-aviation-navy-deep)]">{event.title}</h4>

                      <div className="mt-3 grid gap-2 text-sm text-[var(--apg-text-secondary)] md:grid-cols-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.16em]">Thời điểm</div>
                          <div className="mt-1 font-medium text-[var(--apg-aviation-navy-deep)]">{formatDateTime(event.occurredAt)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.16em]">PNR</div>
                          <div className="mt-1 font-medium text-[var(--apg-aviation-navy-deep)]">{event.pnr || "-"}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.16em]">Actor</div>
                          <div className="mt-1 break-all font-medium text-[var(--apg-aviation-navy-deep)]">{actorId || "Chưa ghi nhận"}</div>
                        </div>
                      </div>

                      {note ? <p className="mt-4 text-sm leading-6 text-[var(--apg-text-secondary)]">{note}</p> : null}
                    </div>

                    <details className="min-w-0 overflow-hidden rounded-[18px] border border-[var(--apg-border-default)] bg-white xl:w-[360px]">
                      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--apg-aviation-navy-deep)]">Xem payload JSON</summary>
                      <pre className="max-h-[280px] overflow-auto border-t border-[var(--apg-border-default)] px-4 py-4 text-xs leading-6 text-[var(--apg-aviation-navy-deep)]">
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
    </section>
  );
}
