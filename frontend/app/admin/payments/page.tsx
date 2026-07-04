import Link from "next/link";

import { MiniChip } from "@/components/admin/ui/Chip";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/DataTable";
import { formatNumber, formatTime, formatVnd } from "@/lib/admin/ui/format";
import type { Tone } from "@/lib/admin/ui/tones";
import { PAYMENT_CAPTURE_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { adminPaymentOpsQuerySchema, listAdminPaymentOps, type AdminPaymentOpsTransaction } from "@/lib/payments/admin";

export const dynamic = "force-dynamic";

interface AdminPaymentsPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

type PayScope = "all" | "manual_review" | "matched";

const SCOPE_LABELS: Record<PayScope, string> = {
  all: "Tất cả",
  manual_review: "Cần đối soát",
  matched: "Đã khớp",
};

const SCOPE_ORDER: PayScope[] = ["all", "manual_review", "matched"];

function singleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// BankTransactionStatus → nhãn + tone miniChip (parity bảng "Khớp thanh toán" file thiết kế).
function transactionChip(status: string): { label: string; tone: Tone; needsReview: boolean } {
  switch (status) {
    case "MATCHED":
      return { label: "Tự khớp", tone: "ok", needsReview: false };
    case "MANUAL_REVIEW":
      return { label: "Đối soát tay", tone: "red", needsReview: true };
    case "RECEIVED":
      return { label: "Mới nhận", tone: "warn", needsReview: false };
    case "DUPLICATE":
      return { label: "Trùng giao dịch", tone: "muted", needsReview: false };
    case "IGNORED":
      return { label: "Đã bỏ qua", tone: "muted", needsReview: false };
    case "FAILED":
      return { label: "Thất bại", tone: "red", needsReview: false };
    default:
      return { label: status, tone: "muted", needsReview: false };
  }
}

function memoLine(transaction: AdminPaymentOpsTransaction): string {
  if (transaction.manualReviewReason) return `${transaction.provider} · ${transaction.manualReviewReason}`;
  if (transaction.status === "MATCHED") return `${transaction.provider} · khớp tự động theo nội dung CK`;
  return transaction.provider;
}

export default async function AdminPaymentsPage({ searchParams }: AdminPaymentsPageProps) {
  const session = await requireRole(PAYMENT_CAPTURE_ROLES);
  const parsedQuery = adminPaymentOpsQuerySchema.parse({
    scope: singleValue(searchParams?.scope) ?? "all",
    provider: singleValue(searchParams?.provider),
    offset: singleValue(searchParams?.offset),
  });
  const result = await listAdminPaymentOps(parsedQuery, { userId: session.user.id, role: session.user.role });

  const currentScope = parsedQuery.scope as PayScope;
  const previousOffset = Math.max(parsedQuery.offset - parsedQuery.limit, 0);
  const nextOffset = parsedQuery.offset + parsedQuery.limit;
  const hasNextPage = nextOffset < result.totalTransactions;
  const pageQuery = (offset: number) => ({
    ...(currentScope !== "all" ? { scope: currentScope } : {}),
    ...(offset > 0 ? { offset: String(offset) } : {}),
  });

  const columns: DataTableColumn<AdminPaymentOpsTransaction>[] = [
    {
      key: "time",
      header: "GIỜ",
      width: "72px",
      render: (row) => <span className="text-[12px] text-[var(--ink-soft)]">{formatTime(row.createdAt)}</span>,
    },
    {
      key: "ref",
      header: "THAM CHIẾU GIAO DỊCH",
      width: "minmax(0,1fr)",
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium">{row.reference ?? row.providerOrderCode ?? "—"}</div>
          <div className="mt-[2px] truncate text-[11px] text-[var(--ink-soft)]">{memoLine(row)}</div>
        </div>
      ),
    },
    {
      key: "amount",
      header: "SỐ TIỀN",
      width: "140px",
      render: (row) => <span className="ofly-serif text-[15px] font-medium">{formatVnd(row.amount)}</span>,
    },
    {
      key: "pnr",
      header: "KHỚP PNR",
      width: "120px",
      render: (row) => (
        <span
          className="ofly-sans text-[13px] font-semibold tracking-[1px]"
          style={{ color: row.pnr ? "var(--rust)" : "var(--ink-faint)" }}
        >
          {row.pnr ?? "?"}
        </span>
      ),
    },
    {
      key: "status",
      header: "TRẠNG THÁI",
      width: "168px",
      render: (row) => {
        const chip = transactionChip(row.status);
        return (
          <div className="flex items-center gap-[10px]">
            <MiniChip tone={chip.tone}>{chip.label}</MiniChip>
            {chip.needsReview ? (
              <Link
                href={
                  row.bookingId
                    ? `/admin/bookings/${row.bookingId}`
                    : row.pnr
                      ? `/admin/bookings?q=${encodeURIComponent(row.pnr)}`
                      : "/admin/bookings"
                }
                className="rounded-[6px] border border-[var(--rust)] bg-transparent px-[9px] py-[5px] text-[11px] font-semibold text-[var(--rust)] transition hover:bg-[var(--rust)] hover:text-[#F5F1EA]"
              >
                Khớp tay
              </Link>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <p className="mb-[22px] max-w-[560px] text-[14px] leading-[1.6] text-[var(--ink-soft)]">
        Giao dịch ngân hàng về qua webhook (SePay / PayOS / VietQR), tự khớp theo nội dung chuyển khoản. Trường hợp không
        khớp được sẽ chuyển sang <strong className="font-semibold text-[var(--ink)]">đối soát thủ công</strong>.
      </p>

      <div className="mb-5 flex flex-wrap gap-[6px]">
        {SCOPE_ORDER.map((scope) => {
          const active = currentScope === scope;
          return (
            <Link
              key={scope}
              href={{ pathname: "/admin/payments", query: scope === "all" ? {} : { scope } }}
              className="rounded-[8px] border px-[14px] py-[8px] text-[12px] font-medium leading-none transition"
              style={
                active
                  ? { borderColor: "var(--rust)", background: "var(--rust)", color: "#F5F1EA" }
                  : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-soft)" }
              }
            >
              {SCOPE_LABELS[scope]}
            </Link>
          );
        })}
      </div>

      <DataTable
        columns={columns}
        rows={result.transactions}
        getRowKey={(row) => row.id}
        empty="Chưa có giao dịch nào trong nhóm này."
        className="overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]"
      />

      <div className="mt-4 flex items-center justify-between text-[12px] text-[var(--ink-soft)]">
        <Link
          href={{ pathname: "/admin/payments", query: pageQuery(previousOffset) }}
          className={`rounded-[8px] border border-[var(--line-strong)] px-[14px] py-[8px] font-medium transition hover:border-[var(--ink)] hover:text-[var(--ink)] ${
            parsedQuery.offset === 0 ? "pointer-events-none opacity-40" : ""
          }`}
        >
          Trang trước
        </Link>
        <span>
          Hiển thị {result.transactions.length} / {formatNumber(result.totalTransactions)} giao dịch
        </span>
        <Link
          href={{ pathname: "/admin/payments", query: pageQuery(nextOffset) }}
          className={`rounded-[8px] border border-[var(--line-strong)] px-[14px] py-[8px] font-medium transition hover:border-[var(--ink)] hover:text-[var(--ink)] ${
            !hasNextPage ? "pointer-events-none opacity-40" : ""
          }`}
        >
          Trang sau
        </Link>
      </div>
    </div>
  );
}
