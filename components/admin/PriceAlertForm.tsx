"use client";

import { useFormState, useFormStatus } from "react-dom";

import type { PriceAlertFormState, PriceAlertFormValues } from "@/app/admin/price-alerts/form-state";
import { initialPriceAlertFormState } from "@/app/admin/price-alerts/form-state";

interface PriceAlertFormProps {
  action: (state: PriceAlertFormState, formData: FormData) => Promise<PriceAlertFormState>;
  initialValues: PriceAlertFormValues;
  submitLabel: string;
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-2 text-sm text-[var(--apg-danger)]">{message}</p>;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button className="apg-btn-primary" type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? "Đang lưu..." : label}
    </button>
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
    <form action={formAction} className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-5">
          <section className="apg-admin-stat px-4 py-4">
            <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Điều kiện alert</div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="apg-field-label">Route</span>
                <input
                  id="route"
                  name="route"
                  className="apg-field mt-2"
                  placeholder="SGN-HAN"
                  defaultValue={resolveValue(state.values, initialValues, "route")}
                  required
                />
                <FieldError message={fieldErrors.route?.[0]} />
              </label>

              <label className="block">
                <span className="apg-field-label">Airline</span>
                <input
                  id="airline"
                  name="airline"
                  className="apg-field mt-2"
                  placeholder="VJ hoặc để trống"
                  defaultValue={resolveValue(state.values, initialValues, "airline")}
                />
                <FieldError message={fieldErrors.airline?.[0]} />
              </label>

              <label className="block">
                <span className="apg-field-label">Giá mục tiêu</span>
                <input
                  id="targetPrice"
                  name="targetPrice"
                  type="number"
                  min="1"
                  step="1000"
                  className="apg-field mt-2"
                  placeholder="1500000"
                  defaultValue={resolveValue(state.values, initialValues, "targetPrice")}
                  required
                />
                <FieldError message={fieldErrors.targetPrice?.[0]} />
              </label>

              <label className="block">
                <span className="apg-field-label">Điều kiện</span>
                <select
                  id="direction"
                  name="direction"
                  className="apg-field mt-2"
                  defaultValue={resolveValue(state.values, initialValues, "direction")}
                >
                  <option value="BELOW">Giá thấp hơn hoặc bằng</option>
                  <option value="ABOVE">Giá cao hơn hoặc bằng</option>
                </select>
                <FieldError message={fieldErrors.direction?.[0]} />
              </label>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="apg-admin-stat px-4 py-4">
            <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Cách hiểu nhanh</div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--apg-text-secondary)]">
              <li>`BELOW` phù hợp khi săn giá xuống dưới ngưỡng.</li>
              <li>`ABOVE` phù hợp khi muốn cảnh báo giá tăng bất thường.</li>
              <li>Để trống airline nếu muốn theo dõi toàn bộ hãng trên cùng route.</li>
            </ul>
          </section>

          <section className="apg-admin-stat px-4 py-4">
            <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Lưu ý vận hành</div>
            <p className="mt-3 text-sm leading-6 text-[var(--apg-text-secondary)]">
              Khi alert được trigger, hệ thống sẽ chuyển trạng thái, ghi AuditLog và phát thông báo nội bộ theo cấu hình notification hiện tại.
            </p>
          </section>
        </aside>
      </div>

      {state.message ? (
        <div className="rounded-[18px] border border-[color:rgba(200,76,58,0.25)] bg-[color:rgba(200,76,58,0.08)] px-4 py-3 text-sm font-medium text-[var(--apg-danger)]">
          {state.message}
        </div>
      ) : null}

      <SubmitButton label={submitLabel} />
    </form>
  );
}
