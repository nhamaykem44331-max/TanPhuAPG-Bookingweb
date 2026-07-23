import { Pencil, Plus } from "lucide-react";

import { toggleMarkupRuleActiveAction } from "@/app/admin/markup-rules/actions";
import { DeleteRuleForm } from "@/components/admin/ConfirmDeleteRuleButton";
import { ButtonLink } from "@/components/admin/ui/Btn";
import { Chip } from "@/components/admin/ui/Chip";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/DataTable";
import { formatNumber, formatVnd } from "@/lib/admin/ui/format";
import { toneVars } from "@/lib/admin/ui/tones";
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

// Công tắc bật/tắt theo Manager (`ui.tsx` → Toggle): 42×24, bo 100px, nền --rust khi bật,
// núm trắng 18px. Vẫn là <button type="submit"> trong form server action nên logic không đổi;
// chữ "Tạm dừng"/"Bật lại" chuyển thành nhãn trợ năng + tooltip.
function ActiveToggle({ rule }: { rule: MarkupRuleRecord }) {
  const label = rule.active ? "Tạm dừng" : "Bật lại";
  return (
    <form action={toggleMarkupRuleActiveAction} className="flex">
      <input type="hidden" name="id" value={rule.id} />
      <input type="hidden" name="active" value={String(!rule.active)} />
      <button
        type="submit"
        role="switch"
        aria-checked={rule.active}
        aria-label={label}
        title={label}
        className="relative h-[24px] w-[42px] shrink-0 cursor-pointer rounded-full border p-0 transition-all duration-[180ms]"
        style={{
          background: rule.active ? "var(--rust)" : "var(--paper3)",
          borderColor: rule.active ? "var(--rust)" : "var(--line2)",
        }}
      >
        <span
          aria-hidden="true"
          className="absolute top-[2px] block h-[18px] w-[18px] rounded-full transition-[left] duration-[180ms]"
          style={{
            left: rule.active ? 20 : 2,
            background: "var(--onInk)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          }}
        />
      </button>
    </form>
  );
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
      render: (row) => (
        <span className="text-[13.5px] font-semibold text-[var(--ink)]">{scopeLabel(row)}</span>
      ),
    },
    {
      key: "cond",
      header: "ĐIỀU KIỆN",
      width: "minmax(0,1fr)",
      render: (row) => <span className="text-[13px] text-[var(--ink3)]">{conditionLabel(row)}</span>,
    },
    {
      key: "value",
      header: "MỨC CỘNG",
      width: "150px",
      // Số → mono (§6 hợp đồng), tô accent để đọc lướt được cột giá.
      render: (row) => (
        <span className="ofly-num text-[13px] font-semibold text-[var(--rust)]">{markupValueLabel(row)}</span>
      ),
    },
    {
      key: "status",
      header: "TRẠNG THÁI",
      width: "130px",
      render: (row) =>
        row.active ? <Chip tone="ok">Đang áp dụng</Chip> : <Chip tone="muted">Tạm dừng</Chip>,
    },
    {
      key: "actions",
      header: "THAO TÁC",
      width: "200px",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-[10px]">
          <ActiveToggle rule={row} />
          <ButtonLink
            href={`/admin/markup-rules/${row.id}/edit`}
            variant="ghost"
            size="sm"
            icon={<Pencil size={14} strokeWidth={1.5} />}
          >
            Sửa
          </ButtonLink>
          <DeleteRuleForm ruleId={row.id} scope={row.scope} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-[22px] flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-[560px] text-[14px] leading-[1.55] text-[var(--ink3)]">
          Quy tắc markup quyết định giá khách thấy trên web. Áp dụng theo thứ tự ưu tiên: đường bay → hãng → mặc định.
        </p>
        <ButtonLink
          href="/admin/markup-rules/new"
          variant="rust"
          icon={<Plus size={16} strokeWidth={1.9} />}
        >
          Tạo quy tắc
        </ButtonLink>
      </div>

      {/* Banner kết quả lấy màu từ biến tone → tự đúng ở cả giao diện Ngày và Đêm. */}
      {status ? (
        <div
          className="mb-[14px] rounded-[10px] border px-[16px] py-[11px] text-[13px] font-medium"
          style={{
            color: toneVars(status.tone === "success" ? "ok" : "red").fg,
            background: toneVars(status.tone === "success" ? "ok" : "red").bg,
            borderColor: toneVars(status.tone === "success" ? "ok" : "red").bd,
          }}
        >
          {status.message}
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={rules}
        getRowKey={(row) => row.id}
        empty="Chưa có quy tắc markup nào."
      />
    </div>
  );
}
