"use client";

import { useFormState, useFormStatus } from "react-dom";

import type { MarkupRuleFormAction } from "@/app/admin/markup-rules/actions";
import { initialMarkupRuleFormState, type MarkupRuleFormValues } from "@/app/admin/markup-rules/form-state";

interface MarkupRuleFormProps {
  action: MarkupRuleFormAction;
  initialValues: MarkupRuleFormValues;
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
    <button className="apg-btn-primary" type="submit" aria-disabled={pending} disabled={pending}>
      {pending ? "Đang lưu..." : label}
    </button>
  );
}

function resolveValue(
  stateValues: Partial<MarkupRuleFormValues> | undefined,
  initialValues: MarkupRuleFormValues,
  key: keyof MarkupRuleFormValues,
): string {
  return stateValues?.[key] ?? initialValues[key];
}

export function MarkupRuleForm({ action, initialValues, submitLabel }: MarkupRuleFormProps) {
  const [state, formAction] = useFormState(action, initialMarkupRuleFormState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-5">
          <section className="apg-admin-stat px-4 py-4">
            <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Định danh rule</div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="apg-field-label">Scope</span>
                <input
                  id="scope"
                  name="scope"
                  className="apg-field mt-2"
                  placeholder="Ví dụ: Quy tắc mặc định web"
                  defaultValue={resolveValue(state.values, initialValues, "scope")}
                  required
                />
                <FieldError message={fieldErrors.scope?.[0]} />
              </label>

              <label className="block">
                <span className="apg-field-label">Airline</span>
                <input
                  id="airline"
                  name="airline"
                  className="apg-field mt-2"
                  placeholder="VJ"
                  defaultValue={resolveValue(state.values, initialValues, "airline")}
                />
                <FieldError message={fieldErrors.airline?.[0]} />
              </label>

              <label className="block">
                <span className="apg-field-label">Channel</span>
                <select
                  id="channel"
                  name="channel"
                  className="apg-field mt-2"
                  defaultValue={resolveValue(state.values, initialValues, "channel")}
                >
                  <option value="">Tất cả</option>
                  <option value="web">Web</option>
                  <option value="admin">Admin</option>
                </select>
                <FieldError message={fieldErrors.channel?.[0]} />
              </label>
            </div>
          </section>

          <section className="apg-admin-stat px-4 py-4">
            <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Phạm vi match</div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="apg-field-label">Cabin</span>
                <input
                  id="cabin"
                  name="cabin"
                  className="apg-field mt-2"
                  placeholder="Economy"
                  defaultValue={resolveValue(state.values, initialValues, "cabin")}
                />
                <FieldError message={fieldErrors.cabin?.[0]} />
              </label>

              <label className="block">
                <span className="apg-field-label">Pax type</span>
                <select
                  id="paxType"
                  name="paxType"
                  className="apg-field mt-2"
                  defaultValue={resolveValue(state.values, initialValues, "paxType")}
                >
                  <option value="">Tất cả</option>
                  <option value="ADT">ADT</option>
                  <option value="CHD">CHD</option>
                  <option value="INF">INF</option>
                </select>
                <FieldError message={fieldErrors.paxType?.[0]} />
              </label>

              <label className="block">
                <span className="apg-field-label">Nội địa / quốc tế</span>
                <select
                  id="domesticInternational"
                  name="domesticInternational"
                  className="apg-field mt-2"
                  defaultValue={resolveValue(state.values, initialValues, "domesticInternational")}
                >
                  <option value="">Tất cả</option>
                  <option value="DOMESTIC">Nội địa</option>
                  <option value="INTERNATIONAL">Quốc tế</option>
                </select>
                <FieldError message={fieldErrors.domesticInternational?.[0]} />
              </label>

              <label className="block">
                <span className="apg-field-label">Route từ</span>
                <input
                  id="routeFrom"
                  name="routeFrom"
                  className="apg-field mt-2"
                  placeholder="SGN"
                  defaultValue={resolveValue(state.values, initialValues, "routeFrom")}
                />
                <FieldError message={fieldErrors.routeFrom?.[0]} />
              </label>

              <label className="block">
                <span className="apg-field-label">Route đến</span>
                <input
                  id="routeTo"
                  name="routeTo"
                  className="apg-field mt-2"
                  placeholder="HAN"
                  defaultValue={resolveValue(state.values, initialValues, "routeTo")}
                />
                <FieldError message={fieldErrors.routeTo?.[0]} />
              </label>
            </div>
          </section>

          <section className="apg-admin-stat px-4 py-4">
            <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Cấu trúc giá</div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="apg-field-label">Loại markup</span>
                <select
                  id="markupType"
                  name="markupType"
                  className="apg-field mt-2"
                  defaultValue={resolveValue(state.values, initialValues, "markupType")}
                >
                  <option value="FIXED">FIXED</option>
                  <option value="PERCENT">PERCENT</option>
                </select>
                <FieldError message={fieldErrors.markupType?.[0]} />
              </label>

              <label className="block">
                <span className="apg-field-label">Giá trị markup</span>
                <input
                  id="markupValue"
                  name="markupValue"
                  type="number"
                  step="0.01"
                  min="0"
                  className="apg-field mt-2"
                  placeholder="150000"
                  defaultValue={resolveValue(state.values, initialValues, "markupValue")}
                  required
                />
                <FieldError message={fieldErrors.markupValue?.[0]} />
              </label>

              <label className="block">
                <span className="apg-field-label">Phí dịch vụ</span>
                <input
                  id="serviceFee"
                  name="serviceFee"
                  type="number"
                  min="0"
                  className="apg-field mt-2"
                  placeholder="0"
                  defaultValue={resolveValue(state.values, initialValues, "serviceFee")}
                  required
                />
                <FieldError message={fieldErrors.serviceFee?.[0]} />
              </label>

              <label className="block">
                <span className="apg-field-label">Priority</span>
                <input
                  id="priority"
                  name="priority"
                  type="number"
                  min="1"
                  max="999"
                  className="apg-field mt-2"
                  placeholder="10"
                  defaultValue={resolveValue(state.values, initialValues, "priority")}
                  required
                />
                <FieldError message={fieldErrors.priority?.[0]} />
              </label>

              <label className="block md:col-span-2">
                <span className="apg-field-label">Trạng thái</span>
                <select
                  id="active"
                  name="active"
                  className="apg-field mt-2"
                  defaultValue={resolveValue(state.values, initialValues, "active")}
                >
                  <option value="true">Đang bật</option>
                  <option value="false">Đang tắt</option>
                </select>
                <FieldError message={fieldErrors.active?.[0]} />
              </label>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="apg-admin-stat px-4 py-4">
            <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Nguyên tắc áp dụng</div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--apg-text-secondary)]">
              <li>Rule được xét theo priority giảm dần.</li>
              <li>Field để trống nghĩa là match toàn bộ phạm vi đó.</li>
              <li>`PERCENT` sẽ được làm tròn theo quy tắc tiền tệ của hệ thống.</li>
            </ul>
          </section>

          <section className="apg-admin-stat px-4 py-4">
            <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Khuyến nghị vận hành</div>
            <p className="mt-3 text-sm leading-6 text-[var(--apg-text-secondary)]">
              Nếu muốn tạo rule dự phòng cho mọi hãng, nên để airline, cabin và route trống rồi dùng priority thấp hơn các rule chuyên biệt.
            </p>
          </section>
        </aside>
      </div>

      {state.message ? (
        <div className="rounded-[18px] border border-[color:rgba(200,76,58,0.25)] bg-[color:rgba(200,76,58,0.08)] px-4 py-3 text-sm font-medium text-[var(--apg-danger)]">
          {state.message}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
