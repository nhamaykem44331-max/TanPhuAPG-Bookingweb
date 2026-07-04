"use client";

import { useFormState, useFormStatus } from "react-dom";

import { loginAction } from "@/app/admin/login/actions";
import { initialLoginFormState } from "@/app/admin/login/form-state";

interface LoginFormProps {
  returnTo: string;
  initialMessage?: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="apg-btn-primary w-full" type="submit" aria-disabled={pending} disabled={pending}>
      {pending ? "Đang đăng nhập..." : "Đăng nhập"}
    </button>
  );
}

export function LoginForm({ returnTo, initialMessage }: LoginFormProps) {
  const [state, formAction] = useFormState(loginAction, initialLoginFormState);
  const message = state.message ?? initialMessage;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="returnTo" value={returnTo} />

      <div>
        <label className="apg-field-label" htmlFor="admin-email">
          Email
        </label>
        <input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="email"
          className="apg-field mt-2"
          placeholder="admin@tanphuapg.com"
          defaultValue={state.email ?? ""}
          required
        />
      </div>

      <div>
        <label className="apg-field-label" htmlFor="admin-password">
          Mật khẩu
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="apg-field mt-2"
          placeholder="Nhập mật khẩu"
          required
        />
      </div>

      {message ? (
        <div className="rounded-lg border border-[color:rgba(255,92,92,0.28)] bg-[color:rgba(255,92,92,0.12)] px-4 py-3 text-sm font-medium text-[var(--apg-danger)]">
          {message}
          {state.retryAfterSeconds ? (
            <div className="mt-1 text-xs font-normal text-[var(--apg-danger)]">
              Thử lại sau khoảng {state.retryAfterSeconds} giây.
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-lg border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] px-4 py-3 text-sm text-[var(--apg-text-secondary)]">
        Phiên đăng nhập có hiệu lực 8 giờ. Hệ thống tự giới hạn 5 lần nhập sai trong 15 phút để bảo vệ khu admin.
      </div>

      <SubmitButton />
    </form>
  );
}
