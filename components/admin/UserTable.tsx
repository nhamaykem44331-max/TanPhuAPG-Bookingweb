import Link from "next/link";

import { getRoleLabel } from "@/lib/auth/constants";
import type { AdminUserRecord } from "@/lib/users/admin";

interface UserTableProps {
  users: AdminUserRecord[];
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

export function UserTable({ users }: UserTableProps) {
  if (users.length === 0) {
    return (
      <div className="apg-admin-sheet p-8">
        <div className="mx-auto max-w-xl text-center">
          <h3 className="text-base font-semibold text-[var(--apg-text-primary)]">Chưa có tài khoản phù hợp</h3>
          <p className="mt-2 text-sm text-[var(--apg-text-secondary)]">Nới từ khóa, role hoặc trạng thái active để xem thêm.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="apg-admin-sheet overflow-hidden">
      <div className="overflow-x-auto">
        <table className="apg-admin-table min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-left font-semibold">Email</th>
              <th className="px-3 py-2.5 text-left font-semibold">Họ tên</th>
              <th className="px-3 py-2.5 text-left font-semibold">Role</th>
              <th className="px-3 py-2.5 text-left font-semibold">Trạng thái</th>
              <th className="px-3 py-2.5 text-left font-semibold">Ngày tạo</th>
              <th className="px-3 py-2.5 text-left font-semibold">Last login</th>
              <th className="px-3 py-2.5 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-[var(--apg-border-default)] align-middle">
                <td className="px-3 py-2.5">
                  <Link className="font-semibold text-[var(--apg-text-primary)] hover:underline" href={`/admin/users/${user.id}`}>
                    {user.email}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-[var(--apg-text-secondary)]">{user.fullName}</td>
                <td className="px-3 py-2.5 text-[var(--apg-text-secondary)]">{getRoleLabel(user.role)}</td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${user.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                    {user.active ? "ACTIVE" : "LOCKED"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-[var(--apg-text-secondary)]">{formatDateTime(user.createdAt)}</td>
                <td className="px-3 py-2.5 text-[var(--apg-text-secondary)]">{formatDateTime(user.lastLoginAt)}</td>
                <td className="px-3 py-2.5 text-right">
                  <Link className="apg-btn-secondary inline-flex h-8 items-center justify-center px-3 text-xs" href={`/admin/users/${user.id}`}>
                    Sửa
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
