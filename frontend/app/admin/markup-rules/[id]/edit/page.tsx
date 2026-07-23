import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { updateMarkupRuleAction } from "@/app/admin/markup-rules/actions";
import { MarkupRuleForm } from "@/components/admin/MarkupRuleForm";
import { SectionTitle } from "@/components/admin/ui/PageHead";
import { Eyebrow, Panel } from "@/components/admin/ui/Panel";
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
    <section className="space-y-[12px]">
      <Link
        href="/admin/markup"
        className="inline-flex items-center gap-[7px] text-[13px] font-semibold text-[var(--ink2)] transition-colors hover:text-[var(--ink)]"
      >
        <ArrowLeft size={15} strokeWidth={1.5} aria-hidden="true" />
        Quay lại danh sách markup
      </Link>

      {/* Panel không padding để cột tóm tắt bên phải tràn viền (dáng DetailPane của Manager). */}
      <Panel padded={false} className="overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,1.4fr)_360px]">
          <div className="px-[20px] py-[18px]">
            <Eyebrow>Markup Control</Eyebrow>
            <SectionTitle className="mt-[10px]">Chỉnh sửa markup rule</SectionTitle>
            <p className="mt-[10px] max-w-[620px] text-[13.5px] leading-[1.6] text-[var(--ink3)]">
              Rule ID: <span className="ofly-num text-[12.5px] font-semibold text-[var(--ink)]">{rule.id}</span>. Mọi thay đổi đều ghi AuditLog theo diff để đội vận hành xem lại chính xác field nào đã đổi.
            </p>
          </div>

          <div className="border-t border-[var(--line)] bg-[var(--paper2)] px-[20px] py-[18px] lg:border-l lg:border-t-0">
            <Eyebrow>Tóm tắt hiện tại</Eyebrow>
            <div className="mt-[12px] space-y-[7px] text-[13.5px] text-[var(--ink3)]">
              <div>Scope: <span className="font-semibold text-[var(--ink)]">{rule.scope}</span></div>
              <div>Airline: <span className="font-semibold text-[var(--ink)]">{rule.airline ?? "Tất cả"}</span></div>
              <div>Priority: <span className="ofly-num font-semibold text-[var(--ink)]">{rule.priority}</span></div>
              <div>Trạng thái: <span className="font-semibold text-[var(--ink)]">{rule.active ? "Đang bật" : "Đang tắt"}</span></div>
            </div>
          </div>
        </div>
      </Panel>

      <MarkupRuleForm
        action={updateAction}
        initialValues={markupRuleToFormValues(rule)}
        submitLabel="Lưu thay đổi"
      />
    </section>
  );
}
