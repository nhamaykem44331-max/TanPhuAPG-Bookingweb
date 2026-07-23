import { ChevronLeft, ChevronRight } from "lucide-react";

import { ButtonLink } from "@/components/admin/ui/Btn";
import { Chip } from "@/components/admin/ui/Chip";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/DataTable";
import { StatTile } from "@/components/admin/ui/Stat";
import { FilterTab } from "@/components/admin/ui/Tabs";
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

// BankTransactionStatus → nhãn + tone Chip (parity bảng "Khớp thanh toán" file thiết kế).
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
  // FilterTab/ButtonLink nhận href dạng chuỗi nên dựng query string tại đây (giữ nguyên
  // đúng bộ tham số cũ: chỉ scope + offset).
  const scopeHref = (scope: PayScope) => (scope === "all" ? "/admin/payments" : `/admin/payments?scope=${scope}`);
  const pageHref = (offset: number) => {
    const params = new URLSearchParams();
    if (currentScope !== "all") params.set("scope", currentScope);
    if (offset > 0) params.set("offset", String(offset));
    const query = params.toString();
    return query ? `/admin/payments?${query}` : "/admin/payments";
  };

  const columns: DataTableColumn<AdminPaymentOpsTransaction>[] = [
    {
      key: "time",
      header: "GIỜ",
      width: "72px",
      render: (row) => <span className="ofly-num text-[12px] text-[var(--ink3)]">{formatTime(row.createdAt)}</span>,
    },
    {
      key: "ref",
      header: "THAM CHIẾU GIAO DỊCH",
      width: "minmax(0,1fr)",
      render: (row) => (
        <div className="min-w-0">
          {/* Mã tham chiếu là chuỗi tra soát → mono cho dễ dò từng ký tự */}
          <div className="ofly-num truncate text-[13px] font-medium text-[var(--ink)]">
            {row.reference ?? row.providerOrderCode ?? "—"}
          </div>
          <div className="mt-[3px] truncate text-[11.5px] text-[var(--ink3)]">{memoLine(row)}</div>
        </div>
      ),
    },
    {
      key: "amount",
      header: "SỐ TIỀN",
      width: "148px",
      align: "right",
      render: (row) => (
        <span className="ofly-num text-[13.5px] font-semibold text-[var(--ink)]">{formatVnd(row.amount)}</span>
      ),
    },
    {
      key: "pnr",
      header: "KHỚP PNR",
      width: "120px",
      render: (row) => (
        <span
          className="ofly-num text-[13px] font-semibold"
          style={{ color: row.pnr ? "var(--rust)" : "var(--ink4)" }}
        >
          {row.pnr ?? "?"}
        </span>
      ),
    },
    {
      key: "status",
      header: "TRẠNG THÁI",
      width: "196px",
      render: (row) => {
        const chip = transactionChip(row.status);
        return (
          <div className="flex flex-wrap items-center justify-end gap-[10px] lg:justify-start">
            {/* Cột TRẠNG THÁI dùng Chip 12px có chấm — đồng bộ với mọi bảng admin khác */}
            <Chip tone={chip.tone}>{chip.label}</Chip>
            {chip.needsReview ? (
              <ButtonLink
                href={
                  row.bookingId
                    ? `/admin/bookings/${row.bookingId}`
                    : row.pnr
                      ? `/admin/bookings?q=${encodeURIComponent(row.pnr)}`
                      : "/admin/bookings"
                }
                variant="ghost"
                size="sm"
              >
                Khớp tay
              </ButtonLink>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <p className="mb-[18px] max-w-[580px] text-[14px] leading-[1.55] text-[var(--ink3)]">
        Giao dịch ngân hàng về qua webhook (SePay / PayOS / VietQR), tự khớp theo nội dung chuyển khoản. Trường hợp không
        khớp được sẽ chuyển sang <strong className="font-semibold text-[var(--ink)]">đối soát thủ công</strong>.
      </p>

      {/* Ô KPI đối soát — "cần đối soát" tone amber để mắt bắt ngay việc phải làm tay */}
      <div className="mb-[18px] flex flex-wrap gap-[12px]">
        <StatTile label="Đang chờ thanh toán" value={formatNumber(result.summary.activeIntentCount)} />
        <StatTile label="Cần đối soát" value={formatNumber(result.summary.manualReviewCount)} tone="amber" />
        <StatTile label="Khớp hôm nay" value={formatNumber(result.summary.matchedTodayCount)} tone="green" />
        <StatTile label="Thông báo chờ gửi" value={formatNumber(result.summary.pendingReminderCount)} />
      </div>

      <div className="mb-[18px] flex flex-wrap gap-[8px]">
        {SCOPE_ORDER.map((scope) => (
          <FilterTab key={scope} href={scopeHref(scope)} active={currentScope === scope}>
            {SCOPE_LABELS[scope]}
          </FilterTab>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={result.transactions}
        getRowKey={(row) => row.id}
        empty="Chưa có giao dịch nào trong nhóm này."
      />

      <div className="mt-4 flex flex-col items-center gap-3 text-[12px] text-[var(--ink3)] sm:flex-row sm:justify-between">
        <ButtonLink
          href={pageHref(previousOffset)}
          variant="ghost"
          size="sm"
          icon={<ChevronLeft size={15} strokeWidth={1.5} />}
          className={`order-2 sm:order-none ${parsedQuery.offset === 0 ? "pointer-events-none opacity-40" : ""}`}
        >
          Trang trước
        </ButtonLink>
        <span className="order-1 text-center sm:order-none">
          Hiển thị <span className="ofly-num text-[var(--ink2)]">{result.transactions.length}</span> /{" "}
          <span className="ofly-num text-[var(--ink2)]">{formatNumber(result.totalTransactions)}</span> giao dịch
        </span>
        <ButtonLink
          href={pageHref(nextOffset)}
          variant="ghost"
          size="sm"
          className={`order-3 sm:order-none ${!hasNextPage ? "pointer-events-none opacity-40" : ""}`}
        >
          Trang sau
          <ChevronRight size={15} strokeWidth={1.5} />
        </ButtonLink>
      </div>
    </div>
  );
}
