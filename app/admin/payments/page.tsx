import Link from "next/link";

import { ADMIN_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { listAdminPaymentOps, adminPaymentOpsQuerySchema } from "@/lib/payments/admin";

interface AdminPaymentsPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

const SCOPE_OPTIONS = [
  { value: "manual_review", label: "Manual review" },
  { value: "active", label: "QR active" },
  { value: "matched", label: "Đã match" },
  { value: "all", label: "Tất cả" },
] as const;

const PROVIDER_OPTIONS = [
  { value: "all", label: "Tất cả nhà CC" },
  { value: "SEPAY", label: "SePay" },
  { value: "PAYOS", label: "PayOS" },
] as const;

function providerBadgeClass(provider: string): string {
  if (provider === "SEPAY") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (provider === "PAYOS") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function singleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatMoney(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function intentStatusClassName(status: string): string {
  if (status === "PAID") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "PENDING" || status === "PARTIAL") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "MANUAL_REVIEW") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function transactionStatusClassName(status: string): string {
  if (status === "MATCHED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "MANUAL_REVIEW") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default async function AdminPaymentsPage({ searchParams }: AdminPaymentsPageProps) {
  const session = await requireRole(ADMIN_ROLES);
  const parsedQuery = adminPaymentOpsQuerySchema.parse({
    pnr: singleValue(searchParams?.pnr),
    scope: singleValue(searchParams?.scope),
    provider: singleValue(searchParams?.provider),
    limit: singleValue(searchParams?.limit),
    offset: singleValue(searchParams?.offset),
  });
  const result = await listAdminPaymentOps(parsedQuery, {
    userId: session.user.id,
    role: session.user.role,
  });
  const previousOffset = Math.max(parsedQuery.offset - parsedQuery.limit, 0);
  const nextOffset = parsedQuery.offset + parsedQuery.limit;
  const hasNextPage = nextOffset < result.totalTransactions;
  const baseQuery = Object.fromEntries(
    Object.entries({
      pnr: parsedQuery.pnr,
      scope: parsedQuery.scope,
      provider: parsedQuery.provider,
      limit: String(parsedQuery.limit),
    }).filter((entry) => entry[1]),
  );

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-base font-semibold text-[var(--apg-text-primary)]">QR Payments</h1>
          <p className="mt-1 text-sm text-[var(--apg-text-secondary)]">Theo dõi QR SePay / PayOS, webhook và manual review.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex">
          <span className="rounded-md border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-3 py-2 text-sm text-lime-300">
            Active {result.summary.activeIntentCount}
          </span>
          <span className="rounded-md border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-3 py-2 text-sm text-rose-300">
            Review {result.summary.manualReviewCount}
          </span>
          <span className="rounded-md border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-3 py-2 text-sm text-cyan-300">
            Match {result.summary.matchedTodayCount}
          </span>
          <span className="rounded-md border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-3 py-2 text-sm text-[var(--apg-text-secondary)]">
            Jobs {result.summary.pendingReminderCount}
          </span>
        </div>
      </section>

      <section className="apg-admin-toolbar px-4 py-4">
        <form className="grid gap-3 xl:grid-cols-[minmax(240px,1fr)_160px_160px_110px_auto_auto] xl:items-end">
          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            PNR / mã booking
            <input className="apg-field mt-2" defaultValue={parsedQuery.pnr ?? ""} name="pnr" placeholder="D8X2QL hoặc APG-260425-XXXXXX" />
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Provider
            <select className="apg-field mt-2" defaultValue={parsedQuery.provider} name="provider">
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Scope
            <select className="apg-field mt-2" defaultValue={parsedQuery.scope} name="scope">
              {SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Limit
            <input className="apg-field mt-2" defaultValue={String(parsedQuery.limit)} min={1} max={100} name="limit" type="number" />
          </label>

          <input name="offset" type="hidden" value="0" />
          <button className="apg-btn-primary w-full" type="submit">
            Lọc
          </button>
          <Link className="apg-btn-secondary inline-flex w-full items-center justify-center" href="/admin/payments">
            Xóa lọc
          </Link>
        </form>
      </section>

      <section className="apg-admin-sheet overflow-hidden">
        <div className="border-b border-[var(--apg-border-default)] px-4 py-3">
          <h2 className="text-sm font-semibold">Payment Intent gần đây</h2>
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="apg-admin-table min-w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold">Đơn hàng</th>
                <th className="px-3 py-2.5 text-left font-semibold">Provider</th>
                <th className="px-3 py-2.5 text-left font-semibold">Khách</th>
                <th className="px-3 py-2.5 text-right font-semibold">Số tiền</th>
                <th className="px-3 py-2.5 text-left font-semibold">Trạng thái</th>
                <th className="px-3 py-2.5 text-left font-semibold">Hết hạn</th>
                <th className="px-3 py-2.5 text-left font-semibold">Webhook</th>
                <th className="px-3 py-2.5 text-left font-semibold">Tạo bởi</th>
                <th className="px-3 py-2.5 text-right font-semibold">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {result.intents.map((intent) => (
                <tr key={intent.id} className="border-t border-[var(--apg-border-default)] align-middle">
                  <td className="px-3 py-2.5">
                    <Link className="apg-mono font-bold tracking-[0.12em] text-cyan-200 hover:underline" href={`/admin/bookings/${intent.bookingId}`}>
                      {intent.orderCode}
                    </Link>
                    <div className="mt-0.5 text-xs text-[var(--apg-text-muted)]">{intent.pnr || "Chưa có PNR chính"}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${providerBadgeClass(intent.provider)}`}>
                      {intent.provider}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="max-w-[220px] truncate font-semibold text-[var(--apg-text-primary)]">{intent.customerName || "-"}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right apg-tabular font-semibold text-[var(--apg-text-primary)]">{formatMoney(intent.amount)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${intentStatusClassName(intent.status)}`}>
                      {intent.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--apg-text-secondary)]">{formatDateTime(intent.expiresAt)}</td>
                  <td className="px-3 py-2.5 text-[var(--apg-text-secondary)]">{intent.matchedWebhookCount}/{intent.manualReviewWebhookCount}</td>
                  <td className="px-3 py-2.5 text-[var(--apg-text-secondary)]">{intent.createdByEmail || "-"}</td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                      {intent.provider === "SEPAY" && (
                        <Link
                          className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
                          href={`/booking/payment/${intent.bookingId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Xem QR
                        </Link>
                      )}
                      {intent.provider === "PAYOS" && intent.checkoutUrl && (
                        <a
                          className="inline-flex items-center rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-300 hover:bg-blue-500/20"
                          href={intent.checkoutUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Mở payOS
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {result.intents.length === 0 ? <div className="px-4 py-8 text-center text-sm text-[var(--apg-text-secondary)]">Không có payment intent phù hợp.</div> : null}
      </section>

      <section className="apg-admin-sheet overflow-hidden">
        <div className="border-b border-[var(--apg-border-default)] px-4 py-3">
          <h2 className="text-sm font-semibold">Webhook Feed</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="apg-admin-table min-w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold">Đơn hàng</th>
                <th className="px-3 py-2.5 text-left font-semibold">Provider</th>
                <th className="px-3 py-2.5 text-left font-semibold">Trạng thái</th>
                <th className="px-3 py-2.5 text-right font-semibold">Số tiền</th>
                <th className="px-3 py-2.5 text-left font-semibold">Reference</th>
                <th className="px-3 py-2.5 text-left font-semibold">Lý do</th>
                <th className="px-3 py-2.5 text-left font-semibold">Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {result.transactions.map((transaction) => (
                <tr key={transaction.id} className="border-t border-[var(--apg-border-default)] align-middle">
                  <td className="px-3 py-2.5">
                    {transaction.bookingId ? (
                      <Link className="apg-mono font-bold tracking-[0.12em] text-cyan-200 hover:underline" href={`/admin/bookings/${transaction.bookingId}`}>
                        {transaction.orderCode || transaction.bookingId.slice(-8)}
                      </Link>
                    ) : (
                      <span className="font-semibold text-[var(--apg-text-primary)]">Unmapped</span>
                    )}
                    <div className="mt-0.5 text-xs text-[var(--apg-text-muted)]">{transaction.pnr || "Chưa có PNR chính"}</div>
                    <div className="mt-0.5 max-w-[220px] truncate text-xs text-[var(--apg-text-muted)]">{transaction.customerName || "-"}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${providerBadgeClass(transaction.provider)}`}>
                      {transaction.provider}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${transactionStatusClassName(transaction.status)}`}>
                      {transaction.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right apg-tabular font-semibold text-[var(--apg-text-primary)]">{formatMoney(transaction.amount)}</td>
                  <td className="px-3 py-2.5 text-[var(--apg-text-secondary)]">{transaction.reference || "-"}</td>
                  <td className="px-3 py-2.5 text-[var(--apg-text-secondary)]">{transaction.manualReviewReason || "-"}</td>
                  <td className="px-3 py-2.5 text-[var(--apg-text-secondary)]">{formatDateTime(transaction.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex items-center justify-between rounded-lg border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-4 py-3">
        <Link
          className={`apg-btn-secondary ${parsedQuery.offset === 0 ? "pointer-events-none opacity-50" : ""}`}
          href={{ pathname: "/admin/payments", query: { ...baseQuery, offset: String(previousOffset) } }}
        >
          Trang trước
        </Link>
        <div className="text-sm text-[var(--apg-text-secondary)]">
          Hiển thị {result.transactions.length} / {result.totalTransactions}
        </div>
        <Link
          className={`apg-btn-secondary ${!hasNextPage ? "pointer-events-none opacity-50" : ""}`}
          href={{ pathname: "/admin/payments", query: { ...baseQuery, offset: String(nextOffset) } }}
        >
          Trang sau
        </Link>
      </div>
    </div>
  );
}
