import Link from "next/link";

import { MarkupRuleTable } from "@/components/admin/MarkupRuleTable";
import { MARKUP_RULE_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { listMarkupRules } from "@/lib/pricing/markupRules";
import { markupRuleListFilterSchema } from "@/lib/pricing/schemas";

interface MarkupRulesPageProps {
  searchParams?: {
    active?: string | string[];
    airline?: string | string[];
    created?: string | string[];
    updated?: string | string[];
    toggled?: string | string[];
    deleted?: string | string[];
    archived?: string | string[];
    error?: string | string[];
  };
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function getStatusMessage(searchParams: MarkupRulesPageProps["searchParams"]): { message: string; tone: "success" | "error" } | null {
  if (searchParams?.created === "1") return { message: "Đã tạo markup rule mới.", tone: "success" };
  if (searchParams?.updated === "1") return { message: "Đã cập nhật markup rule.", tone: "success" };
  if (searchParams?.toggled === "1") return { message: "Đã cập nhật trạng thái active.", tone: "success" };
  if (searchParams?.deleted === "1") return { message: "Đã xoá rule khỏi hệ thống.", tone: "success" };
  if (searchParams?.archived === "1") return { message: "Đã lưu trữ rule (set OFF).", tone: "success" };
  const err = firstParam(searchParams?.error);
  if (err === "delete") return { message: "Xoá rule thất bại — kiểm tra console hoặc audit log.", tone: "error" };
  if (err === "toggle") return { message: "Cập nhật trạng thái thất bại.", tone: "error" };
  if (err === "archive") return { message: "Lưu trữ rule thất bại.", tone: "error" };
  return null;
}

export default async function MarkupRulesPage({ searchParams }: MarkupRulesPageProps) {
  await requireRole(MARKUP_RULE_MANAGER_ROLES);

  const filters = markupRuleListFilterSchema.parse({
    active: Array.isArray(searchParams?.active) ? searchParams?.active[0] : searchParams?.active,
    airline: Array.isArray(searchParams?.airline) ? searchParams?.airline[0] : searchParams?.airline,
  });
  const rules = await listMarkupRules(filters);
  const status = getStatusMessage(searchParams);
  const activeCount = rules.filter((rule) => rule.active).length;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-base font-semibold text-[var(--apg-text-primary)]">Markup Rules</h1>
          <p className="mt-1 text-sm text-[var(--apg-text-secondary)]">Quản lý rule cộng giá cho web và admin.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-3 py-2 text-sm text-[var(--apg-text-secondary)]">
            {activeCount}/{rules.length} active
          </span>
          <Link className="apg-btn-primary inline-flex items-center justify-center px-4" href="/admin/markup-rules/new">
            + Tạo rule
          </Link>
        </div>
      </div>

      {status ? (
        <div
          className={
            status.tone === "success"
              ? "rounded-lg border border-[color:rgba(0,208,132,0.24)] bg-[color:rgba(0,208,132,0.1)] px-4 py-3 text-sm font-medium text-[#27e79b]"
              : "rounded-lg border border-[color:rgba(200,76,58,0.28)] bg-[color:rgba(200,76,58,0.10)] px-4 py-3 text-sm font-medium text-[#ff8266]"
          }
        >
          {status.message}
        </div>
      ) : null}

      <div className="apg-admin-toolbar px-4 py-4">
        <form className="grid gap-3 xl:grid-cols-[180px_180px_auto_auto] xl:items-end">
          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Active
            <select id="filter-active" name="active" className="apg-field mt-2" defaultValue={filters.active === undefined ? "all" : String(filters.active)}>
              <option value="all">Tất cả</option>
              <option value="true">Đang bật</option>
              <option value="false">Đang tắt</option>
            </select>
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Airline
            <input id="filter-airline" name="airline" className="apg-field mt-2" placeholder="VJ" defaultValue={filters.airline ?? ""} />
          </label>

          <button className="apg-btn-primary w-full" type="submit">
            Lọc
          </button>
          <Link className="apg-btn-secondary inline-flex w-full items-center justify-center" href="/admin/markup-rules">
            Xóa lọc
          </Link>
        </form>
      </div>

      <MarkupRuleTable rules={rules} />
    </section>
  );
}
