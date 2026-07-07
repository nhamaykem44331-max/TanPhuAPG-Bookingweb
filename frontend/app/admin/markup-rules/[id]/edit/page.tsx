import Link from "next/link";
import { notFound } from "next/navigation";

import { updateMarkupRuleAction } from "@/app/admin/markup-rules/actions";
import { MarkupRuleForm } from "@/components/admin/MarkupRuleForm";
import { MARKUP_RULE_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { getMarkupRuleById, type MarkupRuleRecord } from "@/lib/pricing/markupRules";

interface EditMarkupRulePageProps {
  params: {
    id: string;
  };
}

function markupRuleToFormValues(rule: MarkupRuleRecord) {
  return {
    scope: rule.scope,
    airline: rule.airline ?? "",
    channel: rule.channel ?? "",
    cabin: rule.cabin ?? "",
    paxType: rule.paxType ?? "",
    domesticInternational: rule.domesticInternational ?? "",
    routeFrom: rule.routeFrom ?? "",
    routeTo: rule.routeTo ?? "",
    markupType: rule.markupType,
    markupValue: rule.markupValue,
    serviceFee: String(rule.serviceFee),
    priority: String(rule.priority),
    active: String(rule.active),
  };
}

export default async function EditMarkupRulePage({ params }: EditMarkupRulePageProps) {
  await requireRole(MARKUP_RULE_MANAGER_ROLES);

  const rule = await getMarkupRuleById(params.id);

  if (!rule) {
    notFound();
  }

  const updateAction = updateMarkupRuleAction.bind(null, rule.id);

  return (
    <section className="space-y-6">
      <div className="apg-admin-sheet overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.4fr)_360px]">
          <div className="px-5 py-6 lg:px-6">
            <Link className="text-sm font-semibold text-[var(--apg-aviation-navy)] hover:underline" href="/admin/markup">
              ← Quay lại danh sách markup
            </Link>
            <p className="apg-eyebrow mt-5">Markup Control</p>
            <h2 className="mt-3 text-3xl font-semibold text-[var(--apg-aviation-navy-deep)]">Chỉnh sửa markup rule</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--apg-text-secondary)]">
              Rule ID: <span className="apg-mono font-semibold">{rule.id}</span>. Mọi thay đổi đều ghi AuditLog theo diff để đội vận hành xem lại chính xác field nào đã đổi.
            </p>
          </div>

          <div className="border-t border-[var(--apg-border-default)] bg-[linear-gradient(180deg,rgba(233,238,242,0.95),rgba(255,255,255,0.98))] px-5 py-5 lg:border-l lg:border-t-0">
            <div className="apg-admin-stat px-4 py-4">
              <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Tóm tắt hiện tại</div>
              <div className="mt-3 space-y-2 text-sm text-[var(--apg-text-secondary)]">
                <div>Scope: <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">{rule.scope}</span></div>
                <div>Airline: <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">{rule.airline ?? "Tất cả"}</span></div>
                <div>Priority: <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">{rule.priority}</span></div>
                <div>Trạng thái: <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">{rule.active ? "Đang bật" : "Đang tắt"}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="apg-admin-toolbar p-5 lg:p-6">
        <MarkupRuleForm
          action={updateAction}
          initialValues={markupRuleToFormValues(rule)}
          submitLabel="Lưu thay đổi"
        />
      </div>
    </section>
  );
}
