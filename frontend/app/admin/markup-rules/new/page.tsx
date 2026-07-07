import Link from "next/link";

import { createMarkupRuleAction } from "@/app/admin/markup-rules/actions";
import { MarkupRuleForm } from "@/components/admin/MarkupRuleForm";
import { MARKUP_RULE_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";

const emptyMarkupRuleValues = {
  scope: "",
  airline: "",
  channel: "",
  cabin: "",
  paxType: "",
  domesticInternational: "",
  routeFrom: "",
  routeTo: "",
  markupType: "FIXED",
  markupValue: "150000",
  serviceFee: "0",
  priority: "10",
  active: "true",
};

export default async function NewMarkupRulePage() {
  await requireRole(MARKUP_RULE_MANAGER_ROLES);

  return (
    <section className="space-y-6">
      <div className="apg-admin-sheet overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.4fr)_360px]">
          <div className="px-5 py-6 lg:px-6">
            <Link className="text-sm font-semibold text-[var(--apg-aviation-navy)] hover:underline" href="/admin/markup">
              ← Quay lại danh sách markup
            </Link>
            <p className="apg-eyebrow mt-5">Markup Control</p>
            <h2 className="mt-3 text-3xl font-semibold text-[var(--apg-aviation-navy-deep)]">Tạo markup rule mới</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--apg-text-secondary)]">
              Khai báo rule theo đúng bề mặt match của Phase 1a: channel, cabin, pax type, route và phạm vi nội địa hay quốc tế. Rule càng rõ thì audit càng dễ.
            </p>
          </div>

          <div className="border-t border-[var(--apg-border-default)] bg-[linear-gradient(180deg,rgba(233,238,242,0.95),rgba(255,255,255,0.98))] px-5 py-5 lg:border-l lg:border-t-0">
            <div className="apg-admin-stat px-4 py-4">
              <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Checklist nhanh</div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--apg-text-secondary)]">
                <li>Rule tổng quát nên để airline và channel trống.</li>
                <li>`PERCENT` chỉ nên dùng khi đội giá cần theo tỷ lệ giá net.</li>
                <li>Ưu tiên càng cao thì rule càng được xét trước.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="apg-admin-toolbar p-5 lg:p-6">
        <MarkupRuleForm action={createMarkupRuleAction} initialValues={emptyMarkupRuleValues} submitLabel="Tạo rule" />
      </div>
    </section>
  );
}
