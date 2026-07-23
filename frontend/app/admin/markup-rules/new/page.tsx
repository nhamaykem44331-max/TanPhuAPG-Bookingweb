import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createMarkupRuleAction } from "@/app/admin/markup-rules/actions";
import { MarkupRuleForm } from "@/components/admin/MarkupRuleForm";
import { SectionTitle } from "@/components/admin/ui/PageHead";
import { Eyebrow, Panel } from "@/components/admin/ui/Panel";
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
    <section className="space-y-[12px]">
      <Link
        href="/admin/markup"
        className="inline-flex items-center gap-[7px] text-[13px] font-semibold text-[var(--ink2)] transition-colors hover:text-[var(--ink)]"
      >
        <ArrowLeft size={15} strokeWidth={1.5} aria-hidden="true" />
        Quay lại danh sách markup
      </Link>

      {/* Panel không padding để cột checklist bên phải tràn viền (dáng DetailPane của Manager). */}
      <Panel padded={false} className="overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,1.4fr)_360px]">
          <div className="px-[20px] py-[18px]">
            <Eyebrow>Markup Control</Eyebrow>
            <SectionTitle className="mt-[10px]">Tạo markup rule mới</SectionTitle>
            <p className="mt-[10px] max-w-[620px] text-[13.5px] leading-[1.6] text-[var(--ink3)]">
              Khai báo rule theo đúng bề mặt match của Phase 1a: channel, cabin, pax type, route và phạm vi nội địa hay quốc tế. Rule càng rõ thì audit càng dễ.
            </p>
          </div>

          <div className="border-t border-[var(--line)] bg-[var(--paper2)] px-[20px] py-[18px] lg:border-l lg:border-t-0">
            <Eyebrow>Checklist nhanh</Eyebrow>
            <ul className="mt-[12px] space-y-[7px] text-[13.5px] leading-[1.55] text-[var(--ink2)]">
              <li>Rule tổng quát nên để airline và channel trống.</li>
              <li>`PERCENT` chỉ nên dùng khi đội giá cần theo tỷ lệ giá net.</li>
              <li>Ưu tiên càng cao thì rule càng được xét trước.</li>
            </ul>
          </div>
        </div>
      </Panel>

      <MarkupRuleForm action={createMarkupRuleAction} initialValues={emptyMarkupRuleValues} submitLabel="Tạo rule" />
    </section>
  );
}
