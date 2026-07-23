"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { Btn } from "@/components/admin/ui/Btn";
import { Field, Input, Textarea } from "@/components/admin/ui/Field";
import { Eyebrow } from "@/components/admin/ui/Panel";
import { StatTile } from "@/components/admin/ui/Stat";
import { toneVars } from "@/lib/admin/ui/tones";

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
      <Btn variant="rust" full disabled={disabled} onClick={() => setOpen(true)}>
        Xuất vé
      </Btn>

      {disabled && disabledReason ? <p className="mt-2 text-[12px] leading-[1.5] text-[var(--ink3)]">{disabledReason}</p> : null}

      {open ? (
        // Modal theo Manager (`kit.tsx` → Modal): overlay mờ + blur, hộp bo 14px, tiêu đề Fraunces.
        <div
          className="ofly-overlay-in fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(20,17,16,0.52)", backdropFilter: "blur(2px)" }}
        >
          <div
            aria-modal="true"
            role="dialog"
            className="ofly-modal-in max-h-[90vh] w-full max-w-[820px] overflow-y-auto rounded-[14px] border border-[var(--line2)] bg-[var(--paper)]"
            style={{ boxShadow: "0 30px 80px -30px rgba(20,17,16,0.55)" }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-[24px] pb-[16px] pt-[22px]">
              <div className="min-w-0">
                <Eyebrow className="mb-2">Xuất vé</Eyebrow>
                <h3 className="ofly-serif m-0 text-[23px] font-medium leading-[1.2] tracking-[-0.6px] text-[var(--ink)]">
                  Xác nhận xuất vé nội bộ
                </h3>
                <p className="m-0 mt-[10px] max-w-[560px] text-[13px] leading-[1.55] text-[var(--ink3)]">
                  Bước này chỉ ghi nhận trạng thái trong admin panel. Không gọi API issue thật của nhà cung cấp.
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[8px] border border-[var(--line2)] bg-transparent text-[var(--ink2)] transition-colors duration-150 hover:bg-[var(--paper2)] disabled:opacity-60"
                disabled={isPending}
                onClick={() => setOpen(false)}
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            <div className="grid gap-5 px-[24px] py-[20px] lg:grid-cols-[minmax(0,1.2fr)_260px]">
              <div className="flex flex-col gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatTile label="Mã đơn hàng" value={pnr} tone="rust" minWidth={0} />
                  <StatTile label="Tổng tiền" value={formatCurrency(totalDue, currency)} minWidth={0} />
                  <StatTile label="Đã thu" value={formatCurrency(totalPaid, currency)} tone="green" minWidth={0} />
                  <StatTile
                    label="Balance"
                    value={formatCurrency(balance, currency)}
                    tone={balance > 0 ? "amber" : "plain"}
                    minWidth={0}
                  />
                </div>

                <div className="rounded-[12px] border border-[var(--line)] bg-[var(--paper2)] px-[16px] py-[14px]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-semibold text-[var(--ink)]">Số vé theo hành khách</div>
                      <p className="m-0 mt-1 text-[12.5px] leading-[1.5] text-[var(--ink3)]">
                        Có thể để trống nếu chưa cần lưu ticket number ở thời điểm này.
                      </p>
                    </div>
                    <Btn
                      variant="ghost"
                      size="sm"
                      icon={<Plus size={14} strokeWidth={1.5} />}
                      disabled={isPending}
                      onClick={() => setTickets((current) => [...current, { passengerName: "", ticketNumber: "" }])}
                    >
                      Thêm dòng
                    </Btn>
                  </div>

                  <div className="mt-4 flex flex-col gap-3">
                    {tickets.map((ticket, index) => (
                      <div key={`${ticket.passengerName}-${index}`} className="grid gap-3 sm:grid-cols-2">
                        <Input
                          disabled={isPending}
                          onChange={(event) => updateTicket(index, "passengerName", event.target.value)}
                          placeholder="Tên hành khách"
                          type="text"
                          value={ticket.passengerName}
                        />
                        <Input
                          disabled={isPending}
                          mono
                          onChange={(event) => updateTicket(index, "ticketNumber", event.target.value)}
                          placeholder="Số vé"
                          type="text"
                          value={ticket.ticketNumber}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Field label="Ghi chú">
                  <Textarea
                    className="min-h-[120px]"
                    disabled={isPending}
                    maxLength={500}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Ghi chú nội bộ khi xác nhận xuất vé."
                    value={notes}
                  />
                </Field>
              </div>

              <aside className="flex flex-col gap-3">
                <div className="rounded-[12px] border border-[var(--line)] bg-[var(--paper)] px-[16px] py-[14px]">
                  <Eyebrow>Checklist trước khi issue</Eyebrow>
                  <ul className="mt-3 flex list-none flex-col gap-2 p-0 text-[12.5px] leading-[1.5] text-[var(--ink2)]">
                    <li>Booking phải ở trạng thái HELD.</li>
                    <li>Balance cần bằng 0 trước khi xác nhận.</li>
                    <li>Booking phải có ít nhất một PNR SUCCESS.</li>
                  </ul>
                </div>

                <div className="rounded-[12px] border border-[var(--line)] bg-[var(--paper)] px-[16px] py-[14px]">
                  <Eyebrow>Lưu ý</Eyebrow>
                  <p className="m-0 mt-3 text-[12.5px] leading-[1.5] text-[var(--ink2)]">
                    Sau khi thành công, hệ thống sẽ khóa lại giá bán và ghi timeline `TICKET_ISSUED`.
                  </p>
                </div>
              </aside>
            </div>

            {message ? (
              <div
                className="mx-[24px] mb-[4px] rounded-[10px] border px-[13px] py-[10px] text-[12.5px] font-medium leading-[1.45]"
                style={{ color: toneVars("red").fg, background: toneVars("red").bg, borderColor: toneVars("red").bd }}
                role="alert"
              >
                {message}
              </div>
            ) : null}

            <div className="mt-[16px] flex flex-wrap justify-end gap-[10px] border-t border-[var(--line)] px-[24px] py-[16px]">
              <Btn variant="ghost" disabled={isPending} onClick={() => setOpen(false)}>
                Hủy
              </Btn>
              <Btn variant="rust" disabled={isPending} onClick={handleSubmit}>
                {isPending ? "Đang xác nhận..." : "Xác nhận xuất vé"}
              </Btn>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
