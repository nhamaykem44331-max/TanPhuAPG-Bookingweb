"use client";

import { AlertCircle } from "lucide-react";
import { useFormState, useFormStatus } from "react-dom";

import { loginAction } from "@/app/admin/login/actions";
import { initialLoginFormState } from "@/app/admin/login/form-state";
import { Btn } from "@/components/admin/ui/Btn";
import { Field, Input } from "@/components/admin/ui/Field";

interface LoginFormProps {
  returnTo: string;
  initialMessage?: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Btn type="submit" variant="rust" size="lg" full disabled={pending}>
      {pending ? "Đang đăng nhập..." : "Đăng nhập"}
    </Btn>
  );
}

export function LoginForm({ returnTo, initialMessage }: LoginFormProps) {
  const [state, formAction] = useFormState(loginAction, initialLoginFormState);
  const message = state.message ?? initialMessage;

  return (
    <form action={formAction} className="space-y-[16px]">
      <input type="hidden" name="returnTo" value={returnTo} />

      <Field label="Email" required>
        <Input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="admin@tanphuapg.com"
          defaultValue={state.email ?? ""}
          required
        />
      </Field>

      <Field label="Mật khẩu" required>
        <Input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Nhập mật khẩu"
          required
        />
      </Field>

      {message ? (
        // Tone red dựng bằng color-mix từ token --red để dark mode tự chỉnh nền/viền.
        <div
          className="flex items-start gap-[8px] rounded-[10px] border px-[14px] py-[11px] text-[13px] font-medium leading-[1.5]"
          style={{
            color: "var(--red)",
            background: "color-mix(in srgb, var(--red) 8%, transparent)",
            borderColor: "color-mix(in srgb, var(--red) 26%, transparent)",
          }}
          role="alert"
        >
          <AlertCircle size={15} strokeWidth={1.5} className="mt-[2px] shrink-0" aria-hidden="true" />
          <span>
            {message}
            {state.retryAfterSeconds ? (
              <span className="mt-[3px] block text-[11.5px] font-normal">
                Thử lại sau khoảng <span className="ofly-num">{state.retryAfterSeconds}</span> giây.
              </span>
            ) : null}
          </span>
        </div>
      ) : null}

      <div className="rounded-[10px] border border-[var(--line)] bg-[var(--paper2)] px-[14px] py-[11px] text-[12px] leading-[1.55] text-[var(--ink3)]">
        Phiên đăng nhập có hiệu lực 8 giờ. Hệ thống tự giới hạn 5 lần nhập sai trong 15 phút để bảo vệ khu admin.
      </div>

      <SubmitButton />
    </form>
  );
}
