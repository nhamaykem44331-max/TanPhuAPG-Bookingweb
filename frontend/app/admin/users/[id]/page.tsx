import Link from "next/link";
import { notFound } from "next/navigation";

import { getRoleLabel, USER_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { getAdminUserById } from "@/lib/users/admin";
import { ResetPasswordDialog } from "@/components/admin/ResetPasswordDialog";
import { UserForm } from "@/components/admin/UserForm";

interface UserDetailPageProps {
  params: {
    id: string;
  };
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  await requireRole(USER_MANAGER_ROLES);
  const user = await getAdminUserById(params.id);

  if (!user) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <section className="apg-admin-sheet overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1.55fr)_380px]">
          <div className="px-5 py-6 lg:px-6">
            <Link className="text-sm font-semibold text-[var(--apg-aviation-navy)] hover:underline" href="/admin/users">
              ← Quay lại danh sách tài khoản
            </Link>
            <p className="apg-eyebrow mt-5">User Control</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--apg-aviation-navy-deep)] text-sm font-semibold tracking-[0.08em] text-white shadow-sm">
                {user.fullName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-[var(--apg-aviation-navy-deep)]">{user.email}</h2>
                <p className="mt-1 text-sm text-[var(--apg-text-secondary)]">{user.fullName} · {getRoleLabel(user.role)}</p>
              </div>
              <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${user.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                {user.active ? "Active" : "Locked"}
              </span>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <article className="apg-admin-stat px-4 py-4">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Họ tên</div>
                <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{user.fullName}</div>
              </article>
              <article className="apg-admin-stat px-4 py-4">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Role</div>
                <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{getRoleLabel(user.role)}</div>
              </article>
              <article className="apg-admin-stat px-4 py-4">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Tạo lúc</div>
                <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{formatDateTime(user.createdAt)}</div>
              </article>
              <article className="apg-admin-stat px-4 py-4">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Đăng nhập cuối</div>
                <div className="mt-2 text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{formatDateTime(user.lastLoginAt)}</div>
              </article>
            </div>
          </div>

          <div className="border-t border-[var(--apg-border-default)] bg-[linear-gradient(180deg,rgba(233,238,242,0.95),rgba(255,255,255,0.98))] px-5 py-5 xl:border-l xl:border-t-0">
            <div className="space-y-3">
              <div className="apg-admin-stat px-4 py-4">
                <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Tác vụ chính</div>
                <div className="mt-3">
                  <ResetPasswordDialog userId={user.id} />
                </div>
              </div>

              <div className="apg-admin-stat px-4 py-4">
                <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Lưu ý bảo mật</div>
                <p className="mt-3 text-sm leading-6 text-[var(--apg-text-secondary)]">
                  Reset password chỉ trả về mật khẩu tạm đúng một lần và không ghi plaintext vào AuditLog.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="apg-admin-toolbar p-5 lg:p-6">
        <UserForm mode="edit" user={user} />
      </div>
    </div>
  );
}
