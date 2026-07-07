import Link from "next/link";

import { toggleMarkupRuleActiveAction } from "@/app/admin/markup-rules/actions";
import { DeleteRuleForm } from "@/components/admin/ConfirmDeleteRuleButton";
import { MiniChip } from "@/components/admin/ui/Chip";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/DataTable";
import { formatNumber, formatVnd } from "@/lib/admin/ui/format";
import { MARKUP_RULE_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { listMarkupRules, type MarkupRuleRecord } from "@/lib/pricing/markupRules";
import { markupRuleListFilterSchema } from "@/lib/pricing/schemas";

export const dynamic = "force-dynamic";

const DOM_INTL_LABELS: Record<string, string> = {
  DOMESTIC: "nội địa",
  INTERNATIONAL: "quốc tế",
};

// Nhãn phạm vi: ưu tiên đường bay → hãng → mặc định (parity cột PHẠM VI file thiết kế).
function scopeLabel(rule: MarkupRuleRecord): string {
  if (rule.routeFrom && rule.routeTo) return `Đường bay ${rule.routeFrom} ⇄ ${rule.routeTo}`;
  if (rule.airline) {
    const suffix = rule.domesticInternational ? ` · ${DOM_INTL_LABELS[rule.domesticInternational] ?? rule.domesticInternational}` : "";
    return `Hãng ${rule.airline}${suffix}`;
  }
  return "Mặc định toàn hệ thống";
}

// Mô tả điều kiện áp dụng gộp từ các trường rule.
function conditionLabel(rule: MarkupRuleRecord): string {
  const parts: string[] = [];
  if (rule.airline) parts.push(`Hãng = ${rule.airline}`);
  if (rule.cabin) parts.push(`hạng ${rule.cabin}`);
  if (rule.domesticInternational) parts.push(DOM_INTL_LABELS[rule.domesticInternational] ?? rule.domesticInternational);
  if (rule.paxType) parts.push(`khách ${rule.paxType}`);
  if (rule.channel) parts.push(`kênh ${rule.channel}`);
  return parts.length > 0 ? parts.join(", ") : "Mọi đơn không khớp quy tắc nào";
}

// "+6%" cho PERCENT, "+120.000₫/khách" cho FIXED.
function markupValueLabel(rule: MarkupRuleRecord): string {
  const amount = Number(rule.markupValue);
  if (rule.markupType === "PERCENT") return `+${formatNumber(amount)}%`;
  return `+${formatVnd(amount)}/khách`;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function statusMessage(sp: AdminMarkupPageProps["searchParams"]): { message: string; tone: "success" | "error" } | null {
  if (firstParam(sp?.created) === "1") return { message: "Đã tạo quy tắc markup mới.", tone: "success" };
  if (firstParam(sp?.updated) === "1") return { message: "Đã cập nhật quy tắc markup.", tone: "success" };
  if (firstParam(sp?.toggled) === "1") return { message: "Đã đổi trạng thái áp dụng.", tone: "success" };
  if (firstParam(sp?.deleted) === "1") return { message: "Đã xoá quy tắc khỏi hệ thống.", tone: "success" };
  if (firstParam(sp?.archived) === "1") return { message: "Đã tạm dừng quy tắc.", tone: "success" };
  const err = firstParam(sp?.error);
  if (err === "delete") return { message: "Xoá quy tắc thất bại — kiểm tra audit log.", tone: "error" };
  if (err === "toggle") return { message: "Đổi trạng thái thất bại.", tone: "error" };
  return null;
}

interface AdminMarkupPageProps {
  searchParams?: {
    created?: string | string[];
    updated?: string | string[];
    toggled?: string | string[];
    deleted?: string | string[];
    archived?: string | string[];
    error?: string | string[];
  };
}

export default async function AdminMarkupPage({ searchParams }: AdminMarkupPageProps) {
  await requireRole(MARKUP_RULE_MANAGER_ROLES);
  const rules = await listMarkupRules(markupRuleListFilterSchema.parse({}));
  const status = statusMessage(searchParams);

  const columns: DataTableColumn<MarkupRuleRecord>[] = [
    {
      key: "scope",
      header: "PHẠM VI",
      width: "minmax(0,1.2fr)",
      render: (row) => <span className="text-[14px] font-medium">{scopeLabel(row)}</span>,
    },
    {
      key: "cond",
      header: "ĐIỀU KIỆN",
      width: "minmax(0,1fr)",
      render: (row) => <span className="text-[13px] text-[var(--ink-soft)]">{conditionLabel(row)}</span>,
    },
    {
      key: "value",
      header: "MỨC CỘNG",
      width: "140px",
      render: (row) => <span className="ofly-serif text-[15px] font-medium text-[var(--rust)]">{markupValueLabel(row)}</span>,
    },
    {
      key: "status",
      header: "TRẠNG THÁI",
      width: "100px",
      render: (row) =>
        row.active ? <MiniChip tone="ok">Đang áp dụng</MiniChip> : <MiniChip tone="muted">Tạm dừng</MiniChip>,
    },
    {
      key: "actions",
      header: "THAO TÁC",
      width: "220px",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/admin/markup-rules/${row.id}/edit`}
            className="text-[12px] font-semibold text-[var(--rust)] hover:underline"
          >
            Sửa
          </Link>
          <form action={toggleMarkupRuleActiveAction}>
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="active" value={String(!row.active)} />
            <button
              type="submit"
              className="text-[12px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] hover:underline"
            >
              {row.active ? "Tạm dừng" : "Bật lại"}
            </button>
          </form>
          <DeleteRuleForm ruleId={row.id} scope={row.scope} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-[22px] flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-[560px] text-[14px] leading-[1.6] text-[var(--ink-soft)]">
          Quy tắc markup quyết định giá khách thấy trên web. Áp dụng theo thứ tự ưu tiên: đường bay → hãng → mặc định.
        </p>
        <Link
          href="/admin/markup-rules/new"
          className="apg-btn-primary inline-flex h-10 shrink-0 items-center justify-center px-4 text-sm font-bold text-white"
        >
          + Tạo quy tắc
        </Link>
      </div>

      {status ? (
        <div
          className={`mb-4 rounded-[10px] border px-4 py-3 text-[13px] font-medium ${
            status.tone === "success"
              ? "border-[color:rgba(31,122,84,0.28)] bg-[color:rgba(31,122,84,0.08)] text-[#1f7a54]"
              : "border-[color:rgba(200,76,58,0.28)] bg-[color:rgba(200,76,58,0.08)] text-[#c2513a]"
          }`}
        >
          {status.message}
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={rules}
        getRowKey={(row) => row.id}
        empty="Chưa có quy tắc markup nào."
        className="overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]"
      />
    </div>
  );
}
