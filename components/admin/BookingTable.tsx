import Link from "next/link";

import { AdminAirlineLogo } from "@/components/admin/AdminAirlineLogo";
import type { AdminBookingRecord } from "@/lib/bookings/admin";

interface BookingTableProps {
  bookings: AdminBookingRecord[];
}

function formatMoney(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
}

function formatDateParts(value: string | null): { time: string; date: string } {
  if (!value) {
    return { time: "--:--", date: "-" };
  }

  const date = new Date(value);

  return {
    time: new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(date),
    date: new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(date),
  };
}

function isHoldOverdue(booking: AdminBookingRecord): boolean {
  return booking.status === "HELD" && !!booking.holdExpiresAt && new Date(booking.holdExpiresAt).getTime() < Date.now();
}

function displayValue(value: string | null | undefined): string {
  return value && value.trim() ? value : "-";
}

function statusClass(status: string, overdue: boolean): string {
  if (overdue || status === "CANCELLED" || status === "PAYMENT_FAILED" || status === "EXPIRED") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (status === "TICKETED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "HELD" || status === "PENDING_PAYMENT") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function statusLabel(status: string, overdue: boolean): string {
  if (overdue) return "HELD · QUÁ HẠN";

  const labels: Record<string, string> = {
    HELD: "HELD",
    PENDING_PAYMENT: "CHỜ THANH TOÁN",
    TICKETED: "TICKETED",
    EXPIRED: "EXPIRED",
    CANCELLED: "CANCELLED",
    PAYMENT_FAILED: "PAYMENT_FAILED",
  };

  return labels[status] ?? status;
}

function pnrStatusLabel(status: string | null): string {
  if (!status) {
    return "Chưa rõ";
  }

  if (status === "SUCCESS") {
    return "SUCCESS";
  }

  if (status === "PENDING") {
    return "PENDING";
  }

  return status;
}

function routeText(route: string): string {
  return route.replace(/-/g, " → ");
}

export function BookingTable({ bookings }: BookingTableProps) {
  if (bookings.length === 0) {
    return (
      <div className="apg-admin-sheet p-8">
        <div className="mx-auto max-w-xl text-center">
          <h3 className="text-base font-semibold text-[var(--apg-text-primary)]">Chưa có PNR phù hợp</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--apg-text-secondary)]">
            Nới điều kiện lọc hoặc đổi khoảng ngày để xem thêm PNR trong cùng đơn hàng.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="apg-admin-sheet overflow-hidden">
      <div className="hidden overflow-x-auto md:block">
        <table className="apg-admin-table min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-left font-semibold">PNR</th>
              <th className="px-3 py-2.5 text-left font-semibold">Mã đơn hàng</th>
              <th className="px-3 py-2.5 text-left font-semibold">Tên đại diện</th>
              <th className="px-3 py-2.5 text-left font-semibold">Hành trình</th>
              <th className="px-3 py-2.5 text-left font-semibold">Khởi hành</th>
              <th className="px-3 py-2.5 text-right font-semibold">Tổng đơn</th>
              <th className="px-3 py-2.5 text-right font-semibold">Markup</th>
              <th className="px-3 py-2.5 text-left font-semibold">Trạng thái đơn</th>
              <th className="px-3 py-2.5 text-left font-semibold">TTL PNR</th>
              <th className="px-3 py-2.5 text-left font-semibold">Ngày tạo</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => {
              const createdAt = formatDateParts(booking.createdAt);
              const departure = formatDateParts(booking.departureDate);
              const ttl = formatDateParts(booking.holdExpiresAt);
              const overdue = isHoldOverdue(booking);

              return (
                <tr key={booking.pnrRecordId} className="border-t border-[var(--apg-border-default)] align-middle hover:bg-[var(--apg-admin-table-hover)]">
                  <td className="px-3 py-2.5">
                    <Link className="apg-pnr-chip apg-mono w-fit" href={`/admin/bookings/${booking.id}`}>
                      {booking.pnr}
                    </Link>
                    <div className="mt-1 text-[11px] text-[var(--apg-text-muted)]">{pnrStatusLabel(booking.pnrStatus)}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-[var(--apg-text-primary)]">{booking.orderCode}</div>
                    <div className="mt-0.5 text-xs text-[var(--apg-text-muted)]">Thanh toán gom theo mã đơn</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="max-w-[220px] truncate font-semibold text-[var(--apg-text-primary)]">{displayValue(booking.customerName)}</div>
                    <div className="mt-0.5 text-xs text-[var(--apg-text-muted)]">{booking.passengerCount} khách</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-[var(--apg-text-primary)]">{routeText(booking.route)}</div>
                    <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--apg-text-muted)]">
                      <AdminAirlineLogo code={booking.airline} airline={booking.airline} size={22} />
                      <span>{displayValue(booking.airline)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="apg-tabular font-semibold text-[var(--apg-text-primary)]">{departure.date}</div>
                    <div className="mt-0.5 text-xs text-[var(--apg-text-muted)]">{departure.time}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="apg-tabular font-semibold text-[var(--apg-text-primary)]">{formatMoney(booking.sellPrice)}</div>
                    <div className="mt-0.5 text-xs text-[var(--apg-text-muted)]">Net {formatMoney(booking.netPrice)}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="apg-tabular font-semibold text-emerald-600">+{formatMoney(booking.markupAmount)}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(booking.status, overdue)}`}>
                      {statusLabel(booking.status, overdue)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className={`apg-tabular font-semibold ${overdue ? "text-rose-600" : "text-[var(--apg-text-primary)]"}`}>
                      {overdue ? "Quá hạn" : ttl.time}
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--apg-text-muted)]">{ttl.date}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="apg-tabular font-semibold text-[var(--apg-text-primary)]">{createdAt.date}</div>
                    <div className="mt-0.5 text-xs text-[var(--apg-text-muted)]">{createdAt.time}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-3 md:hidden">
        {bookings.map((booking) => {
          const departure = formatDateParts(booking.departureDate);
          const overdue = isHoldOverdue(booking);

          return (
            <article key={booking.pnrRecordId} className="rounded-lg border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] p-4">
              <div className="flex items-start justify-between gap-3">
                <Link className="apg-pnr-chip apg-mono" href={`/admin/bookings/${booking.id}`}>
                  {booking.pnr}
                </Link>
                <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(booking.status, overdue)}`}>
                  {statusLabel(booking.status, overdue)}
                </span>
              </div>
              <div className="mt-3 text-sm text-[var(--apg-text-muted)]">{booking.orderCode}</div>
              <div className="mt-2 flex items-center gap-2">
                <AdminAirlineLogo code={booking.airline} airline={booking.airline} size={22} />
                <div className="font-semibold text-[var(--apg-text-primary)]">{displayValue(booking.customerName)}</div>
              </div>
              <div className="mt-1 text-sm text-[var(--apg-text-secondary)]">
                {routeText(booking.route)} · {departure.date} {departure.time}
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-[var(--apg-text-muted)]">Tổng đơn</span>
                <span className="apg-tabular font-semibold text-[var(--apg-text-primary)]">{formatMoney(booking.sellPrice)}</span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
