import Link from "next/link";

import type { AdminCustomerRecord } from "@/lib/customers/admin";

interface CustomerTableProps {
  customers: AdminCustomerRecord[];
}

function formatDateParts(value: string): { time: string; date: string } {
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

function displayValue(value: string | null): string {
  return value && value.trim() ? value : "-";
}

function statusClass(blacklisted: boolean): string {
  return blacklisted ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function initials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "KH";
}

export function CustomerTable({ customers }: CustomerTableProps) {
  if (customers.length === 0) {
    return (
      <div className="apg-admin-sheet p-8">
        <div className="mx-auto max-w-xl text-center">
          <h3 className="text-base font-semibold text-[var(--apg-text-primary)]">Chưa có khách hàng phù hợp</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--apg-text-secondary)]">Thay đổi từ khóa, khoảng ngày hoặc trạng thái blacklist để xem thêm hồ sơ.</p>
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
              <th className="px-3 py-2.5 text-left font-semibold">Khách hàng</th>
              <th className="px-3 py-2.5 text-left font-semibold">Liên hệ</th>
              <th className="px-3 py-2.5 text-left font-semibold">Giấy tờ</th>
              <th className="px-3 py-2.5 text-right font-semibold">Booking</th>
              <th className="px-3 py-2.5 text-left font-semibold">Trạng thái</th>
              <th className="px-3 py-2.5 text-left font-semibold">Ngày tạo</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => {
              const createdAt = formatDateParts(customer.createdAt);

              return (
                <tr key={customer.id} className="border-t border-[var(--apg-border-default)] align-middle hover:bg-[var(--apg-admin-table-hover)]">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--apg-bg-surface-soft)] text-xs font-bold text-[var(--apg-text-primary)]">
                        {initials(customer.fullName)}
                      </div>
                      <div className="min-w-0">
                        <Link className="block max-w-[260px] truncate font-semibold text-[var(--apg-text-primary)] hover:underline" href={`/admin/customers/${customer.id}`}>
                          {customer.fullName}
                        </Link>
                        <div className="mt-0.5 text-xs text-[var(--apg-text-muted)]">{customer.id.slice(-8)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="max-w-[220px] truncate font-medium text-[var(--apg-text-primary)]">{displayValue(customer.phone)}</div>
                    <div className="mt-0.5 max-w-[220px] truncate text-xs text-[var(--apg-text-muted)]">{displayValue(customer.email)}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="max-w-[180px] truncate text-[var(--apg-text-secondary)]">{displayValue(customer.idNumber || customer.passport)}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="apg-tabular font-semibold text-[var(--apg-text-primary)]">{customer.bookingCount}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(customer.blacklisted)}`}>
                      {customer.blacklisted ? "BLACKLIST" : "ACTIVE"}
                    </span>
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
        {customers.map((customer) => (
          <article key={customer.id} className="rounded-lg border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] p-4">
            <div className="flex items-start justify-between gap-3">
              <Link className="font-semibold text-[var(--apg-text-primary)]" href={`/admin/customers/${customer.id}`}>
                {customer.fullName}
              </Link>
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(customer.blacklisted)}`}>
                {customer.blacklisted ? "BLACKLIST" : "ACTIVE"}
              </span>
            </div>
            <div className="mt-2 text-sm text-[var(--apg-text-secondary)]">{displayValue(customer.phone)} · {displayValue(customer.email)}</div>
            <div className="mt-3 text-sm text-[var(--apg-text-muted)]">{customer.bookingCount} booking</div>
          </article>
        ))}
      </div>
    </div>
  );
}
