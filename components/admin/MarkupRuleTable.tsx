import Link from "next/link";

import { toggleMarkupRuleActiveAction } from "@/app/admin/markup-rules/actions";
import type { MarkupRuleRecord } from "@/lib/pricing/markupRules";
import { DeleteRuleForm } from "./ConfirmDeleteRuleButton";

interface MarkupRuleTableProps {
  rules: MarkupRuleRecord[];
}

function formatMoney(value: number): string {
  return `${Number(value).toLocaleString("vi-VN")} ₫`;
}

function formatMarkupValue(rule: MarkupRuleRecord): string {
  if (rule.markupType === "PERCENT") return `${rule.markupValue}%`;
  return formatMoney(Number(rule.markupValue));
}

function formatRoute(rule: MarkupRuleRecord): string {
  if (!rule.routeFrom && !rule.routeTo) return "Tất cả";
  return `${rule.routeFrom ?? "*"} → ${rule.routeTo ?? "*"}`;
}

function formatNullable(value: string | null): string {
  return value || "Tất cả";
}

export function MarkupRuleTable({ rules }: MarkupRuleTableProps) {
  if (rules.length === 0) {
    return (
      <div className="apg-admin-sheet p-8">
        <div className="mx-auto max-w-xl text-center">
          <h3 className="text-base font-semibold text-[var(--apg-text-primary)]">Chưa có markup rule phù hợp</h3>
          <p className="mt-2 text-sm text-[var(--apg-text-secondary)]">Nới bộ lọc active hoặc airline để xem thêm rule.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="apg-admin-sheet overflow-hidden">
      <div className="overflow-x-auto">
        <table className="apg-admin-table min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-left font-semibold">Scope</th>
              <th className="px-3 py-2.5 text-left font-semibold">Match</th>
              <th className="px-3 py-2.5 text-left font-semibold">Route</th>
              <th className="px-3 py-2.5 text-right font-semibold">Markup</th>
              <th className="px-3 py-2.5 text-right font-semibold">Fee</th>
              <th className="px-3 py-2.5 text-right font-semibold">Priority</th>
              <th className="px-3 py-2.5 text-left font-semibold">Active</th>
              <th className="px-3 py-2.5 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="border-t border-[var(--apg-border-default)] align-middle">
                <td className="px-3 py-2.5">
                  <div className="font-semibold text-[var(--apg-text-primary)]">{rule.scope}</div>
                  <div className="mt-0.5 text-xs text-[var(--apg-text-muted)]">{rule.id.slice(-8)}</div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="max-w-[260px] truncate text-[var(--apg-text-secondary)]">
                    {formatNullable(rule.airline)} · {formatNullable(rule.channel)} · {formatNullable(rule.cabin)} · {formatNullable(rule.paxType)}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--apg-text-muted)]">{formatNullable(rule.domesticInternational)}</div>
                </td>
                <td className="px-3 py-2.5 text-[var(--apg-text-secondary)]">{formatRoute(rule)}</td>
                <td className="px-3 py-2.5 text-right">
                  <div className="font-semibold text-[var(--apg-text-primary)]">{rule.markupType}</div>
                  <div className="apg-tabular mt-0.5 text-xs text-[var(--apg-text-muted)]">{formatMarkupValue(rule)}</div>
                </td>
                <td className="px-3 py-2.5 text-right apg-tabular text-[var(--apg-text-secondary)]">{formatMoney(rule.serviceFee)}</td>
                <td className="px-3 py-2.5 text-right apg-tabular font-semibold text-[var(--apg-text-primary)]">{rule.priority}</td>
                <td className="px-3 py-2.5">
                  <form action={toggleMarkupRuleActiveAction}>
                    <input type="hidden" name="id" value={rule.id} />
                    <input type="hidden" name="active" value={String(!rule.active)} />
                    <button className={rule.active ? "apg-chip apg-chip-active" : "apg-chip"} type="submit">
                      {rule.active ? "ACTIVE" : "OFF"}
                    </button>
                  </form>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-2">
                    <Link className="apg-btn-secondary inline-flex h-8 items-center justify-center px-3 text-xs" href={`/admin/markup-rules/${rule.id}/edit`}>
                      Sửa
                    </Link>
                    <DeleteRuleForm ruleId={rule.id} scope={rule.scope} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
