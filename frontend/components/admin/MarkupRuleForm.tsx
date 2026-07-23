"use client";

import { useFormState, useFormStatus } from "react-dom";

import type { MarkupRuleFormAction } from "@/app/admin/markup-rules/actions";
import { initialMarkupRuleFormState, type MarkupRuleFormValues } from "@/app/admin/markup-rules/form-state";
import { Btn } from "@/components/admin/ui/Btn";
import { Field, Input, Select } from "@/components/admin/ui/Field";
import { Eyebrow, Panel } from "@/components/admin/ui/Panel";
import { toneVars } from "@/lib/admin/ui/tones";

interface MarkupRuleFormProps {
  action: MarkupRuleFormAction;
  initialValues: MarkupRuleFormValues;
  submitLabel: string;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Btn variant="rust" type="submit" disabled={pending}>
      {pending ? "Đang lưu..." : label}
    </Btn>
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
  const danger = toneVars("red");

  return (
    <form action={formAction} className="space-y-[12px]">
      {/* Lưới bento 12px như Manager: cột trái là các nhóm trường, cột phải là ghi chú vận hành. */}
      <div className="grid gap-[12px] xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-[12px]">
          <Panel>
            <Eyebrow>Định danh rule</Eyebrow>
            <div className="mt-[16px] grid gap-[14px] md:grid-cols-2">
              <Field label="Scope" required error={fieldErrors.scope?.[0]} className="md:col-span-2">
                <Input
                  id="scope"
                  name="scope"
                  placeholder="Ví dụ: Quy tắc mặc định web"
                  defaultValue={resolveValue(state.values, initialValues, "scope")}
                  error={Boolean(fieldErrors.scope?.[0])}
                  required
                />
              </Field>

              <Field label="Airline" error={fieldErrors.airline?.[0]}>
                <Input
                  id="airline"
                  name="airline"
                  placeholder="VJ"
                  defaultValue={resolveValue(state.values, initialValues, "airline")}
                  error={Boolean(fieldErrors.airline?.[0])}
                />
              </Field>

              <Field label="Channel" error={fieldErrors.channel?.[0]}>
                <Select
                  id="channel"
                  name="channel"
                  defaultValue={resolveValue(state.values, initialValues, "channel")}
                  error={Boolean(fieldErrors.channel?.[0])}
                >
                  <option value="">Tất cả</option>
                  <option value="web">Web</option>
                  <option value="admin">Admin</option>
                </Select>
              </Field>
            </div>
          </Panel>

          <Panel>
            <Eyebrow>Phạm vi match</Eyebrow>
            <div className="mt-[16px] grid gap-[14px] md:grid-cols-2">
              <Field label="Cabin" error={fieldErrors.cabin?.[0]}>
                <Input
                  id="cabin"
                  name="cabin"
                  placeholder="Economy"
                  defaultValue={resolveValue(state.values, initialValues, "cabin")}
                  error={Boolean(fieldErrors.cabin?.[0])}
                />
              </Field>

              <Field label="Pax type" error={fieldErrors.paxType?.[0]}>
                <Select
                  id="paxType"
                  name="paxType"
                  defaultValue={resolveValue(state.values, initialValues, "paxType")}
                  error={Boolean(fieldErrors.paxType?.[0])}
                >
                  <option value="">Tất cả</option>
                  <option value="ADT">ADT</option>
                  <option value="CHD">CHD</option>
                  <option value="INF">INF</option>
                </Select>
              </Field>

              <Field label="Nội địa / quốc tế" error={fieldErrors.domesticInternational?.[0]}>
                <Select
                  id="domesticInternational"
                  name="domesticInternational"
                  defaultValue={resolveValue(state.values, initialValues, "domesticInternational")}
                  error={Boolean(fieldErrors.domesticInternational?.[0])}
                >
                  <option value="">Tất cả</option>
                  <option value="DOMESTIC">Nội địa</option>
                  <option value="INTERNATIONAL">Quốc tế</option>
                </Select>
              </Field>

              <Field label="Route từ" error={fieldErrors.routeFrom?.[0]}>
                <Input
                  id="routeFrom"
                  name="routeFrom"
                  mono
                  placeholder="SGN"
                  defaultValue={resolveValue(state.values, initialValues, "routeFrom")}
                  error={Boolean(fieldErrors.routeFrom?.[0])}
                />
              </Field>

              <Field label="Route đến" error={fieldErrors.routeTo?.[0]}>
                <Input
                  id="routeTo"
                  name="routeTo"
                  mono
                  placeholder="HAN"
                  defaultValue={resolveValue(state.values, initialValues, "routeTo")}
                  error={Boolean(fieldErrors.routeTo?.[0])}
                />
              </Field>
            </div>
          </Panel>

          <Panel>
            <Eyebrow>Cấu trúc giá</Eyebrow>
            <div className="mt-[16px] grid gap-[14px] md:grid-cols-2">
              <Field label="Loại markup" error={fieldErrors.markupType?.[0]}>
                <Select
                  id="markupType"
                  name="markupType"
                  defaultValue={resolveValue(state.values, initialValues, "markupType")}
                  error={Boolean(fieldErrors.markupType?.[0])}
                >
                  <option value="FIXED">FIXED</option>
                  <option value="PERCENT">PERCENT</option>
                </Select>
              </Field>

              <Field label="Giá trị markup" required error={fieldErrors.markupValue?.[0]}>
                <Input
                  id="markupValue"
                  name="markupValue"
                  type="number"
                  step="0.01"
                  min="0"
                  mono
                  placeholder="150000"
                  defaultValue={resolveValue(state.values, initialValues, "markupValue")}
                  error={Boolean(fieldErrors.markupValue?.[0])}
                  required
                />
              </Field>

              <Field label="Phí dịch vụ" required error={fieldErrors.serviceFee?.[0]}>
                <Input
                  id="serviceFee"
                  name="serviceFee"
                  type="number"
                  min="0"
                  mono
                  placeholder="0"
                  defaultValue={resolveValue(state.values, initialValues, "serviceFee")}
                  error={Boolean(fieldErrors.serviceFee?.[0])}
                  required
                />
              </Field>

              <Field label="Priority" required error={fieldErrors.priority?.[0]}>
                <Input
                  id="priority"
                  name="priority"
                  type="number"
                  min="1"
                  max="999"
                  mono
                  placeholder="10"
                  defaultValue={resolveValue(state.values, initialValues, "priority")}
                  error={Boolean(fieldErrors.priority?.[0])}
                  required
                />
              </Field>

              <Field label="Trạng thái" error={fieldErrors.active?.[0]} className="md:col-span-2">
                <Select
                  id="active"
                  name="active"
                  defaultValue={resolveValue(state.values, initialValues, "active")}
                  error={Boolean(fieldErrors.active?.[0])}
                >
                  <option value="true">Đang bật</option>
                  <option value="false">Đang tắt</option>
                </Select>
              </Field>
            </div>
          </Panel>
        </div>

        <aside className="space-y-[12px]">
          <Panel>
            <Eyebrow>Nguyên tắc áp dụng</Eyebrow>
            <ul className="mt-[12px] space-y-[7px] text-[13.5px] leading-[1.55] text-[var(--ink2)]">
              <li>Rule được xét theo priority giảm dần.</li>
              <li>Field để trống nghĩa là match toàn bộ phạm vi đó.</li>
              <li>`PERCENT` sẽ được làm tròn theo quy tắc tiền tệ của hệ thống.</li>
            </ul>
          </Panel>

          <Panel>
            <Eyebrow>Khuyến nghị vận hành</Eyebrow>
            <p className="mt-[12px] text-[13.5px] leading-[1.55] text-[var(--ink2)]">
              Nếu muốn tạo rule dự phòng cho mọi hãng, nên để airline, cabin và route trống rồi dùng priority thấp hơn các rule chuyên biệt.
            </p>
          </Panel>
        </aside>
      </div>

      {/* Lỗi cấp form: màu lấy từ tone red nên đọc được ở cả giao diện Ngày và Đêm. */}
      {state.message ? (
        <div
          className="rounded-[10px] border px-[16px] py-[11px] text-[13px] font-medium"
          style={{ color: danger.fg, background: danger.bg, borderColor: danger.bd }}
        >
          {state.message}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 pt-[2px] sm:flex-row sm:items-center">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
