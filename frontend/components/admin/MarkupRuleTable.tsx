import { Pencil } from "lucide-react";

import { toggleMarkupRuleActiveAction } from "@/app/admin/markup-rules/actions";
import { ButtonLink } from "@/components/admin/ui/Btn";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/DataTable";
import { formatVnd } from "@/lib/admin/ui/format";
import type { MarkupRuleRecord } from "@/lib/pricing/markupRules";
import { DeleteRuleForm } from "./ConfirmDeleteRuleButton";

interface MarkupRuleTableProps {
  rules: MarkupRuleRecord[];
}

function formatMarkupValue(rule: MarkupRuleRecord): string {
  if (rule.markupType === "PERCENT") return `${rule.markupValue}%`;
  return formatVnd(Number(rule.markupValue));
}

function formatRoute(rule: MarkupRuleRecord): string {
  if (!rule.routeFrom && !rule.routeTo) return "Tất cả";
  return `${rule.routeFrom ?? "*"} → ${rule.routeTo ?? "*"}`;
}

function formatNullable(value: string | null): string {
  return value || "Tất cả";
}

// Công tắc bật/tắt theo Manager (`ui.tsx` → Toggle): 42×24, bo 100px, nền --rust khi bật.
// Vẫn là <button type="submit"> của form server action nên logic không đổi.
function ActiveToggle({ rule }: { rule: MarkupRuleRecord }) {
  const label = rule.active ? "ACTIVE" : "OFF";
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

export function MarkupRuleTable({ rules }: MarkupRuleTableProps) {
  if (rules.length === 0) {
    return (
      <div className="rounded-[12px] border border-[var(--line)] bg-[var(--paper)] px-[18px] py-[54px]">
        <div className="mx-auto max-w-xl text-center">
          <h3 className="ofly-serif text-[16px] font-medium text-[var(--ink)]">Chưa có markup rule phù hợp</h3>
          <p className="mt-[8px] text-[13.5px] leading-[1.55] text-[var(--ink3)]">
            Nới bộ lọc active hoặc airline để xem thêm rule.
          </p>
        </div>
      </div>
    );
  }

  const columns: DataTableColumn<MarkupRuleRecord>[] = [
    {
      key: "scope",
      header: "Scope",
      width: "minmax(0,1.1fr)",
      render: (rule) => (
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold text-[var(--ink)]">{rule.scope}</div>
          <div className="ofly-num mt-[3px] text-[11px] text-[var(--ink3)]">{rule.id.slice(-8)}</div>
        </div>
      ),
    },
    {
      key: "match",
      header: "Match",
      width: "minmax(0,1.4fr)",
      render: (rule) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] text-[var(--ink2)]">
            {formatNullable(rule.airline)} · {formatNullable(rule.channel)} · {formatNullable(rule.cabin)} · {formatNullable(rule.paxType)}
          </div>
          <div className="mt-[3px] text-[11.5px] text-[var(--ink3)]">{formatNullable(rule.domesticInternational)}</div>
        </div>
      ),
    },
    {
      key: "route",
      header: "Route",
      width: "130px",
      render: (rule) => <span className="ofly-num text-[13px] text-[var(--ink2)]">{formatRoute(rule)}</span>,
    },
    {
      key: "markup",
      header: "Markup",
      width: "140px",
      align: "right",
      render: (rule) => (
        <div>
          <div className="text-[12px] font-semibold text-[var(--ink)]">{rule.markupType}</div>
          <div className="ofly-num mt-[3px] text-[12px] text-[var(--rust)]">{formatMarkupValue(rule)}</div>
        </div>
      ),
    },
    {
      key: "fee",
      header: "Fee",
      width: "120px",
      align: "right",
      render: (rule) => <span className="ofly-num text-[13px] text-[var(--ink2)]">{formatVnd(rule.serviceFee)}</span>,
    },
    {
      key: "priority",
      header: "Priority",
      width: "90px",
      align: "right",
      render: (rule) => <span className="ofly-num text-[13px] font-semibold text-[var(--ink)]">{rule.priority}</span>,
    },
    {
      key: "active",
      header: "Active",
      width: "80px",
      render: (rule) => <ActiveToggle rule={rule} />,
    },
    {
      key: "actions",
      header: "Actions",
      width: "180px",
      align: "right",
      render: (rule) => (
        <div className="flex items-center justify-end gap-[10px]">
          <ButtonLink
            href={`/admin/markup-rules/${rule.id}/edit`}
            variant="ghost"
            size="sm"
            icon={<Pencil size={14} strokeWidth={1.5} />}
          >
            Sửa
          </ButtonLink>
          <DeleteRuleForm ruleId={rule.id} scope={rule.scope} />
        </div>
      ),
    },
  ];

  return <DataTable columns={columns} rows={rules} getRowKey={(rule) => rule.id} />;
}
