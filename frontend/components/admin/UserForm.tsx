"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Role } from "@prisma/client";

import { ROLE_LABELS } from "@/lib/auth/constants";
import type { AdminUserRecord } from "@/lib/users/admin";

interface UserFormProps {
  mode: "create" | "edit";
  user?: AdminUserRecord;
}

const ROLES: Role[] = ["SUPER_ADMIN", "QUAN_LY_DAI_LY", "NHAN_VIEN_BAN", "KE_TOAN"];

type FieldErrors = Record<string, string[] | undefined>;

export function UserForm({ mode, user }: UserFormProps) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(formData: FormData) {
    setFieldErrors({});
    setFormError(null);
    setTempPassword(null);

    const payload =
      mode === "create"
        ? {
            email: String(formData.get("email") ?? ""),
            fullName: String(formData.get("fullName") ?? ""),
            role: String(formData.get("role") ?? ""),
            active: formData.get("active") === "on",
            tempPassword: String(formData.get("tempPassword") ?? "") || undefined,
          }
        : {
            fullName: String(formData.get("fullName") ?? ""),
            role: String(formData.get("role") ?? ""),
            active: formData.get("active") === "on",
          };

    const response = await fetch(mode === "create" ? "/api/admin/users" : `/api/admin/users/${user?.id}`, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (data.fieldErrors) {
        setFieldErrors(data.fieldErrors);
      }
      setFormError(data.message || data.error || "Không thể lưu tài khoản.");
      return;
    }

    if (mode === "create") {
      setTempPassword(data.tempPassword);
      setCreatedUserId(data.user?.id ?? null);
      return;
    }

    startTransition(() => router.refresh());
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-5">
          <section className="apg-admin-stat px-4 py-4">
            <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Định danh</div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {mode === "create" ? (
                <label className="block md:col-span-2">
                  <span className="apg-field-label">Email</span>
                  <input className="apg-field mt-2" name="email" type="email" />
                  {fieldErrors.email ? <span className="mt-1 block text-xs text-rose-600">{fieldErrors.email[0]}</span> : null}
                </label>
              ) : (
                <div className="md:col-span-2">
                  <span className="apg-field-label">Email</span>
                  <div className="mt-2 rounded-[18px] border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] px-4 py-3 text-[var(--apg-aviation-navy-deep)]">
                    {user?.email}
                  </div>
                </div>
              )}

              <label className="block md:col-span-2">
                <span className="apg-field-label">Họ tên</span>
                <input className="apg-field mt-2" defaultValue={user?.fullName ?? ""} name="fullName" />
                {fieldErrors.fullName ? <span className="mt-1 block text-xs text-rose-600">{fieldErrors.fullName[0]}</span> : null}
              </label>
            </div>
          </section>

          <section className="apg-admin-stat px-4 py-4">
            <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Phân quyền</div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="apg-field-label">Role</span>
                <select className="apg-field mt-2" defaultValue={user?.role ?? "NHAN_VIEN_BAN"} name="role">
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
                {fieldErrors.role ? <span className="mt-1 block text-xs text-rose-600">{fieldErrors.role[0]}</span> : null}
              </label>

              <label className="flex items-center gap-3 rounded-[18px] border border-[var(--apg-border-default)] bg-white px-4 py-3 text-sm font-medium text-[var(--apg-text-secondary)]">
                <input defaultChecked={user?.active ?? true} name="active" type="checkbox" />
                Active
              </label>

              {mode === "create" ? (
                <label className="block md:col-span-2">
                  <span className="apg-field-label">Mật khẩu tạm</span>
                  <input className="apg-field mt-2" name="tempPassword" placeholder="Để trống để hệ thống tự tạo" />
                  {fieldErrors.tempPassword ? <span className="mt-1 block text-xs text-rose-600">{fieldErrors.tempPassword[0]}</span> : null}
                </label>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="apg-admin-stat px-4 py-4">
            <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Khuyến nghị quyền</div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--apg-text-secondary)]">
              <li>`SUPER_ADMIN` chỉ dùng cho quản trị hệ thống và bảo mật.</li>
              <li>`QUAN_LY_DAI_LY` phù hợp cho người điều phối vận hành.</li>
              <li>`KE_TOAN` nên giữ read-only ngoài phần payment.</li>
            </ul>
          </section>

          {tempPassword ? (
            <section className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              Mật khẩu tạm chỉ hiển thị một lần:
              <div className="mt-3 rounded-[14px] bg-white px-3 py-3 font-mono font-semibold text-[var(--apg-aviation-navy-deep)]">
                {tempPassword}
              </div>
              {createdUserId ? (
                <a className="mt-3 inline-flex font-semibold underline" href={`/admin/users/${createdUserId}`}>
                  Mở tài khoản
                </a>
              ) : null}
            </section>
          ) : null}
        </aside>
      </div>

      {formError ? (
        <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button className="apg-btn-primary" disabled={isPending} type="submit">
          {isPending ? "Đang lưu..." : mode === "create" ? "Tạo tài khoản" : "Lưu thay đổi"}
        </button>
        <p className="text-sm text-[var(--apg-text-secondary)]">
          {mode === "create"
            ? "Sau khi tạo xong, hệ thống sẽ giữ mật khẩu tạm trên màn hình này đúng một lần."
            : "Sau khi lưu xong, trang sẽ tự làm mới để cập nhật hồ sơ tài khoản."}
        </p>
      </div>
    </form>
  );
}
