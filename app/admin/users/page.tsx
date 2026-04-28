import Link from "next/link";
import type { Role } from "@prisma/client";

import { ROLE_LABELS, USER_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { listAdminUsers } from "@/lib/users/admin";
import { adminUserListQuerySchema } from "@/lib/users/schemas";
import { UserTable } from "@/components/admin/UserTable";

interface AdminUsersPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

const ROLES: Role[] = ["SUPER_ADMIN", "QUAN_LY_DAI_LY", "NHAN_VIEN_BAN", "KE_TOAN"];

function singleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseActive(value: string | undefined): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  await requireRole(USER_MANAGER_ROLES);

  const parsedQuery = adminUserListQuerySchema.parse({
    q: singleValue(searchParams?.q),
    role: singleValue(searchParams?.role),
    active: parseActive(singleValue(searchParams?.active)),
    limit: singleValue(searchParams?.limit),
    offset: singleValue(searchParams?.offset),
  });
  const result = await listAdminUsers(parsedQuery);
  const previousOffset = Math.max(parsedQuery.offset - parsedQuery.limit, 0);
  const nextOffset = parsedQuery.offset + parsedQuery.limit;
  const hasNextPage = nextOffset < result.total;
  const activeCount = result.items.filter((user) => user.active).length;
  const baseQuery = Object.fromEntries(
    Object.entries({
      q: parsedQuery.q,
      role: parsedQuery.role,
      active: parsedQuery.active === undefined ? undefined : String(parsedQuery.active),
      limit: String(parsedQuery.limit),
    }).filter((entry) => entry[1]),
  );

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-base font-semibold text-[var(--apg-text-primary)]">Users</h1>
          <p className="mt-1 text-sm text-[var(--apg-text-secondary)]">Tài khoản nội bộ, role và reset mật khẩu.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-3 py-2 text-sm text-[var(--apg-text-secondary)]">
            {activeCount}/{result.total} active
          </span>
          <Link className="apg-btn-primary inline-flex items-center justify-center px-4" href="/admin/users/new">
            + Tạo tài khoản
          </Link>
        </div>
      </section>

      <section className="apg-admin-toolbar px-4 py-4">
        <form className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_180px_160px_110px_auto_auto] xl:items-end">
          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Tìm kiếm
            <input className="apg-field mt-2" defaultValue={parsedQuery.q ?? ""} name="q" placeholder="Email hoặc họ tên" />
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Role
            <select className="apg-field mt-2" defaultValue={parsedQuery.role ?? ""} name="role">
              <option value="">Tất cả</option>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Active
            <select className="apg-field mt-2" defaultValue={parsedQuery.active === undefined ? "" : String(parsedQuery.active)} name="active">
              <option value="">Tất cả</option>
              <option value="true">Active</option>
              <option value="false">Locked</option>
            </select>
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Limit
            <input className="apg-field mt-2" defaultValue={String(parsedQuery.limit)} min={1} max={100} name="limit" type="number" />
          </label>

          <input name="offset" type="hidden" value="0" />
          <button className="apg-btn-primary w-full" type="submit">
            Lọc
          </button>
          <Link className="apg-btn-secondary inline-flex w-full items-center justify-center" href="/admin/users">
            Xóa lọc
          </Link>
        </form>
      </section>

      <UserTable users={result.items} />

      <div className="flex items-center justify-between rounded-lg border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-4 py-3">
        <Link
          className={`apg-btn-secondary ${parsedQuery.offset === 0 ? "pointer-events-none opacity-50" : ""}`}
          href={{ pathname: "/admin/users", query: { ...baseQuery, offset: String(previousOffset) } }}
        >
          Trang trước
        </Link>
        <div className="text-sm text-[var(--apg-text-secondary)]">
          Hiển thị {result.items.length} / {result.total}
        </div>
        <Link
          className={`apg-btn-secondary ${!hasNextPage ? "pointer-events-none opacity-50" : ""}`}
          href={{ pathname: "/admin/users", query: { ...baseQuery, offset: String(nextOffset) } }}
        >
          Trang sau
        </Link>
      </div>
    </div>
  );
}
