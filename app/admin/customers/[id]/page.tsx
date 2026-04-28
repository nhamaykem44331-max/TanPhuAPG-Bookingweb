import Link from "next/link";
import { notFound } from "next/navigation";

import { ADMIN_ROLES, CUSTOMER_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { getAdminCustomerById } from "@/lib/customers/admin";
import { CustomerBlacklistDialog } from "@/components/admin/CustomerBlacklistDialog";
import { CustomerForm } from "@/components/admin/CustomerForm";
import { CustomerMergeDialog } from "@/components/admin/CustomerMergeDialog";

interface CustomerDetailPageProps {
  params: {
    id: string;
  };
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatCurrency(value: number, currency: string | null | undefined = "VND"): string {
  return currency === "VND" || !currency ? `${formatMoney(value)} ₫` : `${formatMoney(value)} ${currency}`;
}

function displayValue(value: string | null | undefined): string {
  return value && value.trim() ? value : "-";
}

function stringifyTags(tags: unknown): string {
  if (tags === null || tags === undefined) {
    return "{}";
  }

  return JSON.stringify(tags, null, 2);
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const session = await requireRole(ADMIN_ROLES);
  const detail = await getAdminCustomerById(params.id);

  if (!detail) {
    notFound();
  }

  const { customer, bookings } = detail;
  const canManage = CUSTOMER_MANAGER_ROLES.includes(session.user.role);
  const canMerge = session.user.role === "SUPER_ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--apg-text-secondary)]">
        <Link className="font-semibold text-[var(--apg-aviation-navy)] hover:underline" href="/admin/customers">
          ← Quay lại danh sách khách hàng
        </Link>
        <span className="apg-chip">Customer ID {customer.id.slice(-8)}</span>
        <span className={`apg-chip ${customer.blacklisted ? "apg-chip-active" : ""}`}>
          {customer.blacklisted ? "Đang blacklist" : "Hồ sơ hoạt động"}
        </span>
      </div>

      <section className="apg-admin-sheet overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1.55fr)_380px]">
          <div className="px-5 py-6 lg:px-6">
            <p className="apg-eyebrow">Customer Desk</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--apg-aviation-navy-deep)] text-sm font-semibold tracking-[0.08em] text-white shadow-sm">
                {customer.fullName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-[var(--apg-aviation-navy-deep)]">{customer.fullName}</h2>
                <p className="mt-1 text-sm text-[var(--apg-text-secondary)]">Hồ sơ khách hàng nội bộ dùng cho booking, blacklist và merge duplicate.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <article className="apg-admin-stat px-4 py-4">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Điện thoại</div>
                <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{displayValue(customer.phone)}</div>
              </article>
              <article className="apg-admin-stat px-4 py-4">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Email</div>
                <div className="mt-2 break-all text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{displayValue(customer.email)}</div>
              </article>
              <article className="apg-admin-stat px-4 py-4">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Số booking</div>
                <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{customer.bookingCount}</div>
              </article>
              <article className="apg-admin-stat px-4 py-4">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Tạo lúc</div>
                <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{formatDateTime(customer.createdAt)}</div>
              </article>
            </div>
          </div>

          <div className="border-t border-[var(--apg-border-default)] bg-[linear-gradient(180deg,rgba(233,238,242,0.95),rgba(255,255,255,0.98))] px-5 py-5 xl:border-l xl:border-t-0">
            <div className="space-y-3">
              <div className="apg-admin-stat px-4 py-4">
                <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Tác vụ chính</div>
                <div className="mt-3 flex flex-col gap-3">
                  {canManage ? (
                    <CustomerBlacklistDialog
                      actorId={session.user.id}
                      currentBlacklisted={customer.blacklisted}
                      currentTags={customer.tags}
                      customerId={customer.id}
                    />
                  ) : (
                    <button className="apg-btn-secondary w-full opacity-60" disabled type="button">
                      Chỉ xem hồ sơ
                    </button>
                  )}
                  {canMerge ? (
                    <CustomerMergeDialog
                      disabled={customer.blacklisted}
                      primary={{
                        id: customer.id,
                        fullName: customer.fullName,
                        phone: customer.phone,
                        email: customer.email,
                        bookingCount: customer.bookingCount,
                        blacklisted: customer.blacklisted,
                      }}
                    />
                  ) : (
                    <button className="apg-btn-secondary w-full opacity-60" disabled type="button">
                      Merge duplicate
                    </button>
                  )}
                </div>
              </div>

              <div className="apg-admin-stat px-4 py-4">
                <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Điểm kiểm soát</div>
                <div className="mt-3 space-y-2 text-sm text-[var(--apg-text-secondary)]">
                  <div>CMND / CCCD: <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">{displayValue(customer.idNumber)}</span></div>
                  <div>Passport: <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">{displayValue(customer.passport)}</span></div>
                  <div>Ngày sinh: <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">{displayValue(customer.dob)}</span></div>
                  <div>Created by: <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">{displayValue(customer.createdById)}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="apg-admin-sheet overflow-hidden">
          <div className="border-b border-[var(--apg-border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(238,242,245,0.98))] px-5 py-4 lg:px-6">
            <p className="apg-eyebrow">Customer Profile</p>
            <h3 className="mt-2 text-2xl font-semibold text-[var(--apg-aviation-navy-deep)]">Thông tin và tags nội bộ</h3>
          </div>

          <div className="grid gap-4 p-5 lg:grid-cols-2 lg:p-6">
            <div className="space-y-3">
              <article className="apg-admin-stat px-4 py-4">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Họ tên</div>
                <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{customer.fullName}</div>
              </article>
              <article className="apg-admin-stat px-4 py-4">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Liên hệ</div>
                <div className="mt-2 space-y-1 text-sm text-[var(--apg-text-secondary)]">
                  <div>Điện thoại: <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">{displayValue(customer.phone)}</span></div>
                  <div>Email: <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">{displayValue(customer.email)}</span></div>
                </div>
              </article>
              <article className="apg-admin-stat px-4 py-4">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Giấy tờ</div>
                <div className="mt-2 space-y-1 text-sm text-[var(--apg-text-secondary)]">
                  <div>CMND / CCCD: <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">{displayValue(customer.idNumber)}</span></div>
                  <div>Passport: <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">{displayValue(customer.passport)}</span></div>
                </div>
              </article>
            </div>

            <aside className="apg-admin-stat px-4 py-4">
              <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Tags JSON</div>
              <p className="mt-3 text-sm leading-6 text-[var(--apg-text-secondary)]">
                Đây là vùng metadata phục vụ blacklist reason, merge marker và các cờ nghiệp vụ mở rộng trong các sprint sau.
              </p>
              <pre className="mt-4 max-h-[340px] overflow-auto rounded-[18px] bg-[var(--apg-aviation-navy-deep)]/95 p-4 text-xs leading-6 text-slate-50">
                {stringifyTags(customer.tags)}
              </pre>
            </aside>
          </div>
        </div>

        <section className="apg-admin-toolbar px-5 py-5 lg:px-6">
          <p className="apg-eyebrow">Edit Customer</p>
          <h3 className="mt-2 text-2xl font-semibold text-[var(--apg-aviation-navy-deep)]">Chỉnh sửa hồ sơ</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--apg-text-secondary)]">
            Toàn bộ thay đổi ở đây sẽ ghi AuditLog theo diff để truy nguyên chính xác field nào đã đổi.
          </p>

          <div className="mt-5">
            {canManage ? (
              <CustomerForm customer={customer} mode="edit" />
            ) : (
              <div className="rounded-[20px] border border-dashed border-[var(--apg-border-default)] bg-white px-4 py-10 text-center text-sm text-[var(--apg-text-secondary)]">
                Role hiện tại chỉ có quyền xem hồ sơ khách hàng.
              </div>
            )}
          </div>
        </section>
      </section>

      <section className="apg-admin-sheet overflow-hidden">
        <div className="border-b border-[var(--apg-border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(238,242,245,0.98))] px-5 py-4 lg:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="apg-eyebrow">Booking History</p>
              <h3 className="mt-2 text-2xl font-semibold text-[var(--apg-aviation-navy-deep)]">Lịch sử booking của khách hàng</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--apg-text-secondary)]">
              <span className="apg-chip">{bookings.length} booking liên kết</span>
              <span className="apg-chip">Điều hướng hai chiều sang booking detail</span>
            </div>
          </div>
        </div>

        <div className="p-5 lg:p-6">
          {bookings.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-4 py-10 text-center text-sm text-[var(--apg-text-secondary)]">
              Khách hàng này chưa có booking.
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:hidden">
                {bookings.map((booking) => (
                  <article key={booking.id} className="rounded-[22px] border border-[var(--apg-border-default)] bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--apg-text-secondary)]">{booking.status}</div>
                        <Link className="mt-2 block text-xl font-semibold text-[var(--apg-aviation-navy)] hover:underline" href={`/admin/bookings/${booking.id}`}>
                          {booking.pnr || "PENDING"}
                        </Link>
                      </div>
                      <div className="apg-tabular text-lg font-semibold text-[var(--apg-aviation-navy-deep)]">
                        {formatCurrency(booking.saleAmount, booking.currency)}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-[var(--apg-text-secondary)]">
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em]">Hành trình</div>
                        <div className="mt-1 text-[var(--apg-aviation-navy-deep)]">{booking.routeSummary}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em]">Ngày tạo</div>
                        <div className="mt-1 text-[var(--apg-aviation-navy-deep)]">{formatDateTime(booking.createdAt)}</div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="apg-admin-table min-w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="px-5 py-4 font-semibold">Booking</th>
                      <th className="px-4 py-4 font-semibold">Hành trình</th>
                      <th className="px-4 py-4 font-semibold">Giá bán</th>
                      <th className="px-4 py-4 font-semibold">Trạng thái</th>
                      <th className="px-5 py-4 font-semibold">Ngày tạo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((booking) => (
                      <tr key={booking.id} className="border-t border-[var(--apg-border-default)] align-top">
                        <td className="px-5 py-4">
                          <Link className="font-semibold text-[var(--apg-aviation-navy)] hover:underline" href={`/admin/bookings/${booking.id}`}>
                            {booking.pnr || "PENDING"}
                          </Link>
                          <div className="mt-1 text-xs text-[var(--apg-text-secondary)]">{booking.id.slice(-8)}</div>
                        </td>
                        <td className="px-4 py-4 text-[var(--apg-aviation-navy-deep)]">{booking.routeSummary}</td>
                        <td className="px-4 py-4">
                          <div className="apg-tabular font-semibold text-[var(--apg-aviation-navy-deep)]">
                            {formatCurrency(booking.saleAmount, booking.currency)}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-[var(--apg-text-secondary)]">{booking.status}</td>
                        <td className="px-5 py-4 text-[var(--apg-text-secondary)]">{formatDateTime(booking.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
