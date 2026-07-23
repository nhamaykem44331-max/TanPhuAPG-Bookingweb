import type { Role } from "@prisma/client";
import { ShieldCheck, Ticket, UserCog, type LucideIcon } from "lucide-react";

import { Chip } from "@/components/admin/ui/Chip";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/DataTable";
import { Panel } from "@/components/admin/ui/Panel";
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
  // Icon lucide thay cho khối màu — mỗi vai trò có một dấu hiệu nhận biết nhanh.
  icon: LucideIcon;
}

// Vai trò hiển thị trên web (KE_TOAN đã gỡ — nghiệp vụ kế toán chuyển sang RMS).
const ROLE_CARDS: RoleMeta[] = [
  {
    role: "SUPER_ADMIN",
    name: "Quản trị hệ thống",
    desc: "Toàn quyền vận hành: hàng đợi, đơn, thanh toán, markup, phân quyền, bàn giao RMS.",
    icon: ShieldCheck,
  },
  {
    role: "QUAN_LY_DAI_LY",
    name: "Quản lý đại lý",
    desc: "Quản lý kênh bán: cấu hình markup, bàn giao RMS, đối soát thanh toán và theo dõi phễu vận hành.",
    icon: UserCog,
  },
  {
    role: "NHAN_VIEN_BAN",
    name: "Nhân viên xuất vé",
    desc: "Nhận & xử lý đơn trong hàng đợi, xuất vé, xử lý không xuất được / hoàn tiền, gửi thông báo.",
    icon: Ticket,
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
  // Có mốc đăng nhập thật → hiển thị mono; chưa có → câu chữ thường.
  everLoggedIn: boolean;
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
    everLoggedIn: Boolean(user.lastLoginAt),
    active: user.active,
  }));

  const columns: DataTableColumn<UserRow>[] = [
    {
      key: "user",
      header: "NGƯỜI DÙNG",
      width: "minmax(0,1fr)",
      render: (row) => (
        <div className="flex min-w-0 items-center gap-[12px]">
          {/* Avatar chữ cái trên khối navy đặc — #FFFFFF là ngoại lệ hex duy nhất hợp đồng cho phép */}
          <span
            aria-hidden="true"
            className="flex h-[28px] w-[28px] flex-none items-center justify-center rounded-full text-[11px] font-bold"
            style={{ background: "var(--gradNavy)", color: "#FFFFFF" }}
          >
            {row.initial}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-semibold text-[var(--ink)]">{row.name}</div>
            <div className="truncate text-[11.5px] text-[var(--ink3)]">{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "VAI TRÒ",
      width: "190px",
      render: (row) => (
        <Chip tone="info" dot={false}>
          {ROLE_SHORT[row.role]}
        </Chip>
      ),
    },
    {
      key: "last",
      header: "HOẠT ĐỘNG GẦN NHẤT",
      width: "180px",
      render: (row) => (
        <span className={`text-[12px] text-[var(--ink3)] ${row.everLoggedIn ? "ofly-num" : ""}`}>{row.last}</span>
      ),
    },
    {
      key: "status",
      header: "TRẠNG THÁI",
      width: "150px",
      render: (row) => (row.active ? <Chip tone="ok">Đang hoạt động</Chip> : <Chip tone="muted">Đã khoá</Chip>),
    },
  ];

  return (
    <div>
      <div className="mb-[12px] grid gap-[12px] md:grid-cols-2 xl:grid-cols-3">
        {ROLE_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Panel key={card.role} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[8px] bg-[var(--paper2)] text-[var(--rust)]">
                  <Icon size={16} strokeWidth={1.5} />
                </span>
                <span className="ofly-num text-[13px] font-bold leading-none text-[var(--rust)]">
                  {countByRole.get(card.role) ?? 0}
                  <span className="ofly-sans ml-[5px] text-[11px] font-semibold text-[var(--ink3)]">người</span>
                </span>
              </div>
              <div className="ofly-serif mt-[14px] text-[18px] font-medium tracking-[-0.4px] text-[var(--ink)]">
                {card.name}
              </div>
              <p className="m-0 mt-[7px] text-[12px] leading-[1.55] text-[var(--ink3)]">{card.desc}</p>
            </Panel>
          );
        })}
      </div>

      <div className="mb-[12px] rounded-[12px] border border-dashed border-[var(--line2)] bg-[var(--paper2)] px-[18px] py-[13px]">
        <p className="ofly-serif m-0 text-[13px] italic leading-[1.5] text-[var(--ink3)]">
          Vai trò “Kế toán” đã được gỡ khỏi trang web — toàn bộ nghiệp vụ kế toán, doanh thu, công nợ chuyển sang RMS.
        </p>
      </div>

      <DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} empty="Chưa có tài khoản nội bộ nào." />
    </div>
  );
}
