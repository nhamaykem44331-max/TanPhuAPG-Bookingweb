"use client";

import { useFormState, useFormStatus } from "react-dom";

import type { PriceAlertFormState, PriceAlertFormValues } from "@/app/admin/price-alerts/form-state";
import { initialPriceAlertFormState } from "@/app/admin/price-alerts/form-state";
import { Btn } from "@/components/admin/ui/Btn";
import { Field, Input, Select } from "@/components/admin/ui/Field";
import { Panel, PanelHeading } from "@/components/admin/ui/Panel";

interface PriceAlertFormProps {
  action: (state: PriceAlertFormState, formData: FormData) => Promise<PriceAlertFormState>;
  initialValues: PriceAlertFormValues;
  submitLabel: string;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Btn type="submit" variant="rust" disabled={pending}>
      {pending ? "Đang lưu..." : label}
    </Btn>
  );
}

function resolveValue(
  stateValues: Partial<PriceAlertFormValues> | undefined,
  initialValues: PriceAlertFormValues,
  key: keyof PriceAlertFormValues,
): string {
  return stateValues?.[key] ?? initialValues[key];
}

export function PriceAlertForm({ action, initialValues, submitLabel }: PriceAlertFormProps) {
  const [state, formAction] = useFormState(action, initialPriceAlertFormState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Panel>
          <PanelHeading eyebrow="Điều kiện alert" />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Route" required error={fieldErrors.route?.[0]}>
              <Input
                id="route"
                name="route"
                mono
                error={Boolean(fieldErrors.route?.[0])}
                placeholder="SGN-HAN"
                defaultValue={resolveValue(state.values, initialValues, "route")}
                required
              />
            </Field>

            <Field label="Airline" error={fieldErrors.airline?.[0]}>
              <Input
                id="airline"
                name="airline"
                mono
                error={Boolean(fieldErrors.airline?.[0])}
                placeholder="VJ hoặc để trống"
                defaultValue={resolveValue(state.values, initialValues, "airline")}
              />
            </Field>

            <Field label="Giá mục tiêu" required error={fieldErrors.targetPrice?.[0]}>
              <Input
                id="targetPrice"
                name="targetPrice"
                type="number"
                min="1"
                step="1000"
                mono
                error={Boolean(fieldErrors.targetPrice?.[0])}
                placeholder="1500000"
                defaultValue={resolveValue(state.values, initialValues, "targetPrice")}
                required
              />
            </Field>

            <Field label="Điều kiện" error={fieldErrors.direction?.[0]}>
              <Select
                id="direction"
                name="direction"
                error={Boolean(fieldErrors.direction?.[0])}
                defaultValue={resolveValue(state.values, initialValues, "direction")}
                options={[
                  { value: "BELOW", label: "Giá thấp hơn hoặc bằng" },
                  { value: "ABOVE", label: "Giá cao hơn hoặc bằng" },
                ]}
              />
            </Field>
          </div>
        </Panel>

        <aside className="space-y-3">
          <Panel>
            <PanelHeading eyebrow="Cách hiểu nhanh" />
            <ul className="mt-3 space-y-2 text-[13px] leading-[1.6] text-[var(--ink2)]">
              <li>
                <span className="ofly-num text-[var(--ink)]">BELOW</span> phù hợp khi săn giá xuống dưới ngưỡng.
              </li>
              <li>
                <span className="ofly-num text-[var(--ink)]">ABOVE</span> phù hợp khi muốn cảnh báo giá tăng bất
                thường.
              </li>
              <li>Để trống airline nếu muốn theo dõi toàn bộ hãng trên cùng route.</li>
            </ul>
          </Panel>

          <Panel>
            <PanelHeading eyebrow="Lưu ý vận hành" />
            <p className="mt-3 text-[13px] leading-[1.6] text-[var(--ink2)]">
              Khi alert được trigger, hệ thống sẽ chuyển trạng thái, ghi AuditLog và phát thông báo nội bộ theo cấu
              hình notification hiện tại.
            </p>
          </Panel>
        </aside>
      </div>

      {state.message ? (
        <div
          className="rounded-[10px] border px-[14px] py-[11px] text-[13px] font-medium"
          style={{
            background: "color-mix(in srgb, var(--red) 8%, transparent)",
            borderColor: "color-mix(in srgb, var(--red) 26%, transparent)",
            color: "var(--red)",
          }}
        >
          {state.message}
        </div>
      ) : null}

      <SubmitButton label={submitLabel} />
    </form>
  );
}
