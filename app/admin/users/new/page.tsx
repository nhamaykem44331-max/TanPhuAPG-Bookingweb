import Link from "next/link";

import { USER_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { UserForm } from "@/components/admin/UserForm";

export default async function NewUserPage() {
  await requireRole(USER_MANAGER_ROLES);

  return (
    <div className="space-y-6">
      <section className="apg-admin-sheet overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.4fr)_360px]">
          <div className="px-5 py-6 lg:px-6">
            <Link className="text-sm font-semibold text-[var(--apg-aviation-navy)] hover:underline" href="/admin/users">
              ← Quay lại danh sách tài khoản
            </Link>
            <p className="apg-eyebrow mt-5">User Control</p>
            <h2 className="mt-3 text-3xl font-semibold text-[var(--apg-aviation-navy-deep)]">Tạo tài khoản nội bộ</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--apg-text-secondary)]">
              Email là định danh đăng nhập và không chỉnh sửa sau khi tạo. Mật khẩu tạm có thể để hệ thống sinh tự động và chỉ hiển thị một lần.
            </p>
          </div>

          <div className="border-t border-[var(--apg-border-default)] bg-[linear-gradient(180deg,rgba(233,238,242,0.95),rgba(255,255,255,0.98))] px-5 py-5 lg:border-l lg:border-t-0">
            <div className="apg-admin-stat px-4 py-4">
              <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Checklist nhanh</div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--apg-text-secondary)]">
                <li>Chỉ dùng email thật và duy nhất cho mỗi nhân sự.</li>
                <li>Role nên gán sát công việc để tránh mở quyền quá rộng.</li>
                <li>Nếu để trống mật khẩu tạm, hệ thống sẽ sinh chuỗi mạnh mặc định.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <div className="apg-admin-toolbar p-5 lg:p-6">
        <UserForm mode="create" />
      </div>
    </div>
  );
}
