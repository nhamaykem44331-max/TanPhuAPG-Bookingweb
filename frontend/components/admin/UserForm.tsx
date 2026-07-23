"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import type { Role } from "@prisma/client";

import { Btn } from "@/components/admin/ui/Btn";
import { Field, Input, Select } from "@/components/admin/ui/Field";
import { Eyebrow, Panel } from "@/components/admin/ui/Panel";
import { ROLE_LABELS } from "@/lib/auth/constants";
import type { AdminUserRecord } from "@/lib/users/admin";

interface UserFormProps {
  mode: "create" | "edit";
  user?: AdminUserRecord;
}

const ROLES: Role[] = ["SUPER_ADMIN", "QUAN_LY_DAI_LY", "NHAN_VIEN_BAN", "KE_TOAN"];

const ROLE_HINTS = [
  "`SUPER_ADMIN` chỉ dùng cho quản trị hệ thống và bảo mật.",
  "`QUAN_LY_DAI_LY` phù hợp cho người điều phối vận hành.",
  "`KE_TOAN` nên giữ read-only ngoài phần payment.",
];

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
    <form action={onSubmit} className="flex flex-col gap-[12px]">
      <div className="grid gap-[12px] xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="flex flex-col gap-[12px]">
          <Panel>
            <Eyebrow>Định danh</Eyebrow>
            <div className="mt-[14px] grid gap-[14px] md:grid-cols-2">
              {mode === "create" ? (
                <Field label="Email" error={fieldErrors.email?.[0]} className="md:col-span-2">
                  <Input name="email" type="email" error={Boolean(fieldErrors.email)} />
                </Field>
              ) : (
                <div className="md:col-span-2">
                  <Eyebrow>Email</Eyebrow>
                  {/* Email khoá sau khi tạo → ô chỉ-đọc: cùng hình ô nhập nhưng không viền tương tác */}
                  <div className="mt-[7px] rounded-[8px] border border-[var(--line)] bg-[var(--paper2)] px-[13px] py-[11px] text-[14px] text-[var(--ink)]">
                    {user?.email}
                  </div>
                </div>
              )}

              <Field label="Họ tên" error={fieldErrors.fullName?.[0]} className="md:col-span-2">
                <Input defaultValue={user?.fullName ?? ""} name="fullName" error={Boolean(fieldErrors.fullName)} />
              </Field>
            </div>
          </Panel>

          <Panel>
            <Eyebrow>Phân quyền</Eyebrow>
            <div className="mt-[14px] grid gap-[14px] md:grid-cols-2">
              <Field label="Role" error={fieldErrors.role?.[0]}>
                <Select
                  defaultValue={user?.role ?? "NHAN_VIEN_BAN"}
                  name="role"
                  error={Boolean(fieldErrors.role)}
                  options={ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
                />
              </Field>

              <label className="flex items-center gap-[10px] self-end rounded-[8px] border border-[var(--line2)] bg-[var(--paper2)] px-[13px] py-[11px] text-[14px] font-medium text-[var(--ink2)]">
                <input
                  defaultChecked={user?.active ?? true}
                  name="active"
                  type="checkbox"
                  className="h-[15px] w-[15px] accent-[var(--rust)]"
                />
                Active
              </label>

              {mode === "create" ? (
                <Field
                  label="Mật khẩu tạm"
                  error={fieldErrors.tempPassword?.[0]}
                  className="md:col-span-2"
                >
                  <Input
                    mono
                    name="tempPassword"
                    placeholder="Để trống để hệ thống tự tạo"
                    error={Boolean(fieldErrors.tempPassword)}
                  />
                </Field>
              ) : null}
            </div>
          </Panel>
        </div>

        <aside className="flex flex-col gap-[12px]">
          <Panel>
            <Eyebrow>Khuyến nghị quyền</Eyebrow>
            <ul className="m-0 mt-[12px] flex list-none flex-col gap-[9px] p-0">
              {ROLE_HINTS.map((hint) => (
                <li key={hint} className="flex items-start gap-[9px] text-[12.5px] leading-[1.55] text-[var(--ink3)]">
                  <span
                    aria-hidden="true"
                    className="mt-[7px] h-[5px] w-[5px] flex-none rounded-full bg-[var(--rustSoft)]"
                  />
                  {hint}
                </li>
              ))}
            </ul>
          </Panel>

          {tempPassword ? (
            <div
              className="rounded-[12px] border px-[18px] py-[16px]"
              style={{
                background: "color-mix(in srgb, var(--amber) 8%, var(--paper))",
                borderColor: "color-mix(in srgb, var(--amber) 32%, transparent)",
              }}
            >
              <div className="flex items-center gap-[8px] text-[12.5px] font-semibold text-[var(--amber)]">
                <AlertTriangle size={15} strokeWidth={1.5} />
                Mật khẩu tạm chỉ hiển thị một lần:
              </div>
              <div className="ofly-num mt-[12px] rounded-[8px] border border-[var(--line)] bg-[var(--paper)] px-[13px] py-[11px] text-[14px] font-bold text-[var(--ink)]">
                {tempPassword}
              </div>
              {createdUserId ? (
                <a
                  className="mt-[12px] inline-flex items-center gap-[6px] text-[12.5px] font-semibold text-[var(--rust)] hover:underline"
                  href={`/admin/users/${createdUserId}`}
                >
                  Mở tài khoản
                  <ArrowUpRight size={14} strokeWidth={1.5} />
                </a>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>

      {formError ? (
        <div
          className="flex items-center gap-[9px] rounded-[12px] border px-[18px] py-[13px] text-[13px]"
          style={{
            background: "color-mix(in srgb, var(--red) 8%, var(--paper))",
            borderColor: "color-mix(in srgb, var(--red) 30%, transparent)",
            color: "var(--red)",
          }}
        >
          <AlertTriangle size={15} strokeWidth={1.5} className="flex-none" />
          {formError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-[14px]">
        <Btn type="submit" variant="rust" disabled={isPending}>
          {isPending ? "Đang lưu..." : mode === "create" ? "Tạo tài khoản" : "Lưu thay đổi"}
        </Btn>
        <p className="m-0 text-[12.5px] text-[var(--ink3)]">
          {mode === "create"
            ? "Sau khi tạo xong, hệ thống sẽ giữ mật khẩu tạm trên màn hình này đúng một lần."
            : "Sau khi lưu xong, trang sẽ tự làm mới để cập nhật hồ sơ tài khoản."}
        </p>
      </div>
    </form>
  );
}
