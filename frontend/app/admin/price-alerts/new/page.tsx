import Link from "next/link";

import { createPriceAlertAction } from "@/app/admin/price-alerts/actions";
import { defaultPriceAlertFormValues } from "@/app/admin/price-alerts/form-state";
import { PriceAlertForm } from "@/components/admin/PriceAlertForm";
import { PRICE_ALERT_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";

export default async function NewPriceAlertPage() {
  await requireRole(PRICE_ALERT_MANAGER_ROLES);

  return (
    <section className="space-y-6">
      <div className="apg-admin-sheet overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.4fr)_360px]">
          <div className="px-5 py-6 lg:px-6">
            <Link className="text-sm font-semibold text-[var(--apg-aviation-navy)] hover:underline" href="/admin/price-alerts">
              ← Quay lại danh sách price alerts
            </Link>
            <p className="apg-eyebrow mt-5">Price Alert Center</p>
            <h2 className="mt-3 text-3xl font-semibold text-[var(--apg-aviation-navy-deep)]">Tạo cảnh báo giá mới</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--apg-text-secondary)]">
              Tạo một alert theo route và ngưỡng giá để đội vận hành nhận được tín hiệu nội bộ ngay khi mức giá đi vào vùng cần quan tâm.
            </p>
          </div>

          <div className="border-t border-[var(--apg-border-default)] bg-[linear-gradient(180deg,rgba(233,238,242,0.95),rgba(255,255,255,0.98))] px-5 py-5 lg:border-l lg:border-t-0">
            <div className="apg-admin-stat px-4 py-4">
              <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Checklist nhanh</div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--apg-text-secondary)]">
                <li>Route viết theo mẫu `SGN-HAN`.</li>
                <li>Để trống airline nếu muốn áp dụng cho mọi hãng.</li>
                <li>Chọn `BELOW` cho alert săn giá thấp.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="apg-admin-toolbar p-5 lg:p-6">
        <PriceAlertForm action={createPriceAlertAction} initialValues={defaultPriceAlertFormValues} submitLabel="Tạo price alert" />
      </div>
    </section>
  );
}
