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

export default async function AdminMarkupPage() {
  await requireRole(MARKUP_RULE_MANAGER_ROLES);
  const rules = await listMarkupRules(markupRuleListFilterSchema.parse({}));

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
      width: "150px",
      render: (row) => <span className="ofly-serif text-[15px] font-medium text-[var(--rust)]">{markupValueLabel(row)}</span>,
    },
    {
      key: "status",
      header: "TRẠNG THÁI",
      width: "110px",
      render: (row) =>
        row.active ? <MiniChip tone="ok">Đang áp dụng</MiniChip> : <MiniChip tone="muted">Tạm dừng</MiniChip>,
    },
  ];

  return (
    <div>
      <p className="mb-[22px] max-w-[560px] text-[14px] leading-[1.6] text-[var(--ink-soft)]">
        Quy tắc markup quyết định giá khách thấy trên web. Áp dụng theo thứ tự ưu tiên: đường bay → hãng → mặc định.
      </p>

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
