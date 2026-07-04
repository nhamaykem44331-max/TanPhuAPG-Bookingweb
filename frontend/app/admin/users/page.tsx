import type { Role } from "@prisma/client";

import { MiniChip } from "@/components/admin/ui/Chip";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/DataTable";
import { formatDateTime } from "@/lib/admin/ui/format";
import { USER_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { prisma } from "@/lib/db";
import { listAdminUsers } from "@/lib/users/admin";
import { adminUserListQuerySchema } from "@/lib/users/schemas";

export const dynamic = "force-dynamic";

interface RoleMeta {
  role: Role;
  name: string;
  desc: string;
}

// Vai trò hiển thị trên web (KE_TOAN đã gỡ — nghiệp vụ kế toán chuyển sang RMS).
const ROLE_CARDS: RoleMeta[] = [
  {
    role: "SUPER_ADMIN",
    name: "Quản trị hệ thống",
    desc: "Toàn quyền vận hành: hàng đợi, đơn, thanh toán, markup, phân quyền, bàn giao RMS.",
  },
  {
    role: "QUAN_LY_DAI_LY",
    name: "Quản lý đại lý",
    desc: "Quản lý kênh bán: cấu hình markup, bàn giao RMS, đối soát thanh toán và theo dõi phễu vận hành.",
  },
  {
    role: "NHAN_VIEN_BAN",
    name: "Nhân viên xuất vé",
    desc: "Nhận & xử lý đơn trong hàng đợi, xuất vé, xử lý không xuất được / hoàn tiền, gửi thông báo.",
  },
];

const ROLE_SHORT: Record<Role, string> = {
  SUPER_ADMIN: "Quản trị hệ thống",
  QUAN_LY_DAI_LY: "Quản lý đại lý",
  NHAN_VIEN_BAN: "Nhân viên xuất vé",
  KE_TOAN: "Kế toán",
};

interface UserRow {
  id: string;
  name: string;
  email: string;
  initial: string;
  role: Role;
  last: string;
  active: boolean;
}

// Chữ cái đầu của tên gọi (từ cuối trong họ tên) cho avatar; fallback ký tự đầu email.
function initialOf(fullName: string, email: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const base = parts.length > 0 ? parts[parts.length - 1] : email;
  return (base.charAt(0) || "?").toUpperCase();
}

export default async function AdminUsersPage() {
  await requireRole(USER_MANAGER_ROLES);

  const [list, roleCounts] = await Promise.all([
    listAdminUsers(adminUserListQuerySchema.parse({ limit: "100" })),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
  ]);

  const countByRole = new Map<string, number>(roleCounts.map((row) => [row.role as string, row._count._all]));

  const rows: UserRow[] = list.items.map((user) => ({
    id: user.id,
    name: user.fullName,
    email: user.email,
    initial: initialOf(user.fullName, user.email),
    role: user.role,
    last: user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Chưa đăng nhập",
    active: user.active,
  }));

  const columns: DataTableColumn<UserRow>[] = [
    {
      key: "user",
      header: "NGƯỜI DÙNG",
      width: "minmax(0,1fr)",
      render: (row) => (
        <div className="flex min-w-0 items-center gap-[12px]">
          <div className="flex h-[32px] w-[32px] flex-none items-center justify-center rounded-full bg-[var(--surface-2)] ofly-serif text-[13px] font-medium text-[var(--ink-soft)]">
            {row.initial}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-medium">{row.name}</div>
            <div className="truncate text-[11px] text-[var(--ink-soft)]">{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "VAI TRÒ",
      width: "180px",
      render: (row) => <span className="text-[13px]">{ROLE_SHORT[row.role]}</span>,
    },
    {
      key: "last",
      header: "HOẠT ĐỘNG GẦN NHẤT",
      width: "170px",
      render: (row) => <span className="text-[12px] text-[var(--ink-soft)]">{row.last}</span>,
    },
    {
      key: "status",
      header: "TRẠNG THÁI",
      width: "110px",
      render: (row) =>
        row.active ? <MiniChip tone="ok">Đang hoạt động</MiniChip> : <MiniChip tone="muted">Đã khoá</MiniChip>,
    },
  ];

  return (
    <div>
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {ROLE_CARDS.map((card) => (
          <div
            key={card.role}
            className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-[24px] py-[22px]"
          >
            <div className="ofly-serif text-[18px] font-medium">{card.name}</div>
            <div className="mt-[8px] text-[12px] leading-[1.55] text-[var(--ink-soft)]">{card.desc}</div>
            <div className="mt-[14px] ofly-sans text-[11px] font-semibold text-[var(--rust)]">
              {countByRole.get(card.role) ?? 0} người
            </div>
          </div>
        ))}
      </div>

      <div className="mb-[18px] rounded-[8px] border border-dashed border-[var(--line-strong)] bg-[var(--surface-2)] px-[16px] py-[13px] ofly-serif text-[12px] italic text-[var(--ink-soft)]">
        Vai trò “Kế toán” đã được gỡ khỏi trang web — toàn bộ nghiệp vụ kế toán, doanh thu, công nợ chuyển sang RMS.
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        empty="Chưa có tài khoản nội bộ nào."
        className="overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]"
      />
    </div>
  );
}
