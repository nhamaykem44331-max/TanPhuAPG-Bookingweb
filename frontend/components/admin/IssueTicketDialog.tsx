"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

interface IssueTicketDialogProps {
  bookingId: string;
  pnr: string;
  currency: string;
  totalDue: number;
  totalPaid: number;
  balance: number;
  passengerNames: string[];
  disabled: boolean;
  disabledReason: string | null;
}

interface TicketNumberInput {
  passengerName: string;
  ticketNumber: string;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatCurrency(value: number, currency: string | null | undefined = "VND"): string {
  return currency === "VND" || !currency ? `${formatMoney(value)} ₫` : `${formatMoney(value)} ${currency}`;
}

function buildInitialTickets(passengerNames: string[]): TicketNumberInput[] {
  const names = passengerNames.filter((name) => name.trim().length > 0);

  if (names.length === 0) {
    return [{ passengerName: "", ticketNumber: "" }];
  }

  return names.map((name) => ({
    passengerName: name,
    ticketNumber: "",
  }));
}

export function IssueTicketDialog({
  bookingId,
  pnr,
  currency,
  totalDue,
  totalPaid,
  balance,
  passengerNames,
  disabled,
  disabledReason,
}: IssueTicketDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [tickets, setTickets] = useState<TicketNumberInput[]>(() => buildInitialTickets(passengerNames));

  function updateTicket(index: number, field: keyof TicketNumberInput, value: string) {
    setTickets((current) =>
      current.map((ticket, ticketIndex) => (ticketIndex === index ? { ...ticket, [field]: value } : ticket)),
    );
  }

  async function handleSubmit() {
    setIsPending(true);
    setMessage(null);

    const ticketNumbers = tickets
      .map((ticket) => ({
        passengerName: ticket.passengerName.trim(),
        ticketNumber: ticket.ticketNumber.trim(),
      }))
      .filter((ticket) => ticket.passengerName && ticket.ticketNumber);

    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/issue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ticketNumbers,
          notes,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            message?: string;
            balance?: number;
          }
        | null;

      if (!response.ok) {
        const balanceMessage =
          typeof payload?.balance === "number" ? ` Còn thiếu ${formatCurrency(payload.balance, currency)}.` : "";
        setMessage(payload?.message || `${payload?.error || "Không thể xuất vé."}${balanceMessage}`);
        return;
      }

      setOpen(false);
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setMessage("Kết nối tới API xuất vé bị gián đoạn, vui lòng thử lại.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <button
        className={`w-full rounded-[var(--apg-radius-md)] px-4 py-2 text-sm font-semibold transition ${
          disabled
            ? "cursor-not-allowed border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] text-[var(--apg-text-secondary)] opacity-70"
            : "border border-amber-300 bg-amber-500 text-white hover:bg-amber-600"
        }`}
        disabled={disabled}
        onClick={() => setOpen(true)}
        type="button"
      >
        Xuất vé
      </button>

      {disabled && disabledReason ? <p className="text-xs leading-5 text-[var(--apg-text-secondary)]">{disabledReason}</p> : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-8">
          <div className="apg-admin-toolbar max-h-[90vh] w-full max-w-4xl overflow-y-auto px-5 py-5 lg:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="apg-eyebrow">Issue Ticket</p>
                <h3 className="mt-2 text-2xl font-semibold text-[var(--apg-aviation-navy-deep)]">Xác nhận xuất vé nội bộ</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--apg-text-secondary)]">
                  Bước này chỉ ghi nhận trạng thái trong admin panel. Không gọi API issue thật của nhà cung cấp.
                </p>
              </div>
              <button className="apg-btn-secondary" disabled={isPending} onClick={() => setOpen(false)} type="button">
                Đóng
              </button>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_320px]">
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <article className="apg-admin-stat px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Mã đơn hàng</div>
                    <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{pnr}</div>
                  </article>
                  <article className="apg-admin-stat px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Tổng tiền</div>
                    <div className="mt-2 apg-tabular text-base font-semibold text-[var(--apg-aviation-navy-deep)]">
                      {formatCurrency(totalDue, currency)}
                    </div>
                  </article>
                  <article className="apg-admin-stat px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Đã thu</div>
                    <div className="mt-2 apg-tabular text-base font-semibold text-[var(--apg-aviation-navy-deep)]">
                      {formatCurrency(totalPaid, currency)}
                    </div>
                  </article>
                  <article className="apg-admin-stat px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Balance</div>
                    <div className="mt-2 apg-tabular text-base font-semibold text-[var(--apg-aviation-navy-deep)]">
                      {formatCurrency(balance, currency)}
                    </div>
                  </article>
                </div>

                <div className="apg-admin-sheet px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--apg-aviation-navy-deep)]">Số vé theo hành khách</div>
                      <p className="mt-1 text-sm text-[var(--apg-text-secondary)]">Có thể để trống nếu chưa cần lưu ticket number ở thời điểm này.</p>
                    </div>
                    <button className="apg-btn-secondary h-9 px-4 text-xs" disabled={isPending} onClick={() => setTickets((current) => [...current, { passengerName: "", ticketNumber: "" }])} type="button">
                      Thêm dòng
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {tickets.map((ticket, index) => (
                      <div key={`${ticket.passengerName}-${index}`} className="grid gap-3 sm:grid-cols-2">
                        <input
                          className="apg-field"
                          disabled={isPending}
                          onChange={(event) => updateTicket(index, "passengerName", event.target.value)}
                          placeholder="Tên hành khách"
                          type="text"
                          value={ticket.passengerName}
                        />
                        <input
                          className="apg-field"
                          disabled={isPending}
                          onChange={(event) => updateTicket(index, "ticketNumber", event.target.value)}
                          placeholder="Số vé"
                          type="text"
                          value={ticket.ticketNumber}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className="apg-field-label">Ghi chú</span>
                  <textarea
                    className="apg-field mt-2 h-auto min-h-[120px] py-3"
                    disabled={isPending}
                    maxLength={500}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Ghi chú nội bộ khi xác nhận xuất vé."
                    value={notes}
                  />
                </label>
              </div>

              <aside className="space-y-3">
                <div className="apg-admin-stat px-4 py-4">
                  <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Checklist trước khi issue</div>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--apg-text-secondary)]">
                    <li>Booking phải ở trạng thái HELD.</li>
                    <li>Balance cần bằng 0 trước khi xác nhận.</li>
                    <li>Booking phải có ít nhất một PNR SUCCESS.</li>
                  </ul>
                </div>

                <div className="apg-admin-stat px-4 py-4">
                  <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Lưu ý</div>
                  <p className="mt-3 text-sm leading-6 text-[var(--apg-text-secondary)]">
                    Sau khi thành công, hệ thống sẽ khóa lại giá bán và ghi timeline `TICKET_ISSUED`.
                  </p>
                </div>
              </aside>
            </div>

            {message ? (
              <div className="mt-5 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {message}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button className="apg-btn-secondary" disabled={isPending} onClick={() => setOpen(false)} type="button">
                Hủy
              </button>
              <button
                className="rounded-[var(--apg-radius-md)] bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isPending}
                onClick={handleSubmit}
                type="button"
              >
                {isPending ? "Đang xác nhận..." : "Xác nhận xuất vé"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
