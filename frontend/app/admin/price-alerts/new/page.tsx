import { ArrowLeft } from "lucide-react";

import { createPriceAlertAction } from "@/app/admin/price-alerts/actions";
import { defaultPriceAlertFormValues } from "@/app/admin/price-alerts/form-state";
import { PriceAlertForm } from "@/components/admin/PriceAlertForm";
import { ButtonLink } from "@/components/admin/ui/Btn";
import { SectionTitle } from "@/components/admin/ui/PageHead";
import { Eyebrow, Panel, PanelHeading } from "@/components/admin/ui/Panel";
import { PRICE_ALERT_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";

export default async function NewPriceAlertPage() {
  await requireRole(PRICE_ALERT_MANAGER_ROLES);

  return (
    <div>
      {/* Topbar của AdminShell đã giữ h1 "Cảnh báo giá" → màn con dùng SectionTitle (h2) để không có 2 h1. */}
      <div className="mb-[22px] flex flex-col items-start gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Eyebrow>Price Alert Center</Eyebrow>
          <SectionTitle className="mt-[10px]">Tạo cảnh báo giá mới</SectionTitle>
          <p className="mt-[10px] max-w-[580px] text-[14px] leading-[1.6] text-[var(--ink3)]">
            Tạo một alert theo route và ngưỡng giá để đội vận hành nhận được tín hiệu nội bộ ngay khi mức giá đi vào
            vùng cần quan tâm.
          </p>
        </div>
        <ButtonLink
          href="/admin/price-alerts"
          variant="ghost"
          icon={<ArrowLeft size={16} strokeWidth={1.5} />}
        >
          Quay lại danh sách price alerts
        </ButtonLink>
      </div>

      <Panel>
        <PanelHeading eyebrow="Checklist nhanh" />
        <ul className="mt-3 space-y-2 text-[13px] leading-[1.6] text-[var(--ink2)]">
          <li>
            Route viết theo mẫu <span className="ofly-num text-[var(--ink)]">SGN-HAN</span>.
          </li>
          <li>Để trống airline nếu muốn áp dụng cho mọi hãng.</li>
          <li>
            Chọn <span className="ofly-num text-[var(--ink)]">BELOW</span> cho alert săn giá thấp.
          </li>
        </ul>
      </Panel>

      <div className="mt-3">
        <PriceAlertForm
          action={createPriceAlertAction}
          initialValues={defaultPriceAlertFormValues}
          submitLabel="Tạo price alert"
        />
      </div>
    </div>
  );
}
