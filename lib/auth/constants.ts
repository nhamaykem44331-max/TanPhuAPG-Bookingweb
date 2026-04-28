import type { Role } from "@prisma/client";

export const ADMIN_ROLES: Role[] = [
  "SUPER_ADMIN",
  "QUAN_LY_DAI_LY",
  "NHAN_VIEN_BAN",
  "KE_TOAN",
];

export const MARKUP_RULE_MANAGER_ROLES: Role[] = ["SUPER_ADMIN", "QUAN_LY_DAI_LY"];
export const PAYMENT_CAPTURE_ROLES: Role[] = ["SUPER_ADMIN", "QUAN_LY_DAI_LY", "NHAN_VIEN_BAN", "KE_TOAN"];
export const PAYMENT_REJECT_ROLES: Role[] = ["SUPER_ADMIN"];
export const ISSUE_TICKET_ROLES: Role[] = ["SUPER_ADMIN", "QUAN_LY_DAI_LY", "NHAN_VIEN_BAN"];
export const CANCEL_BOOKING_ROLES: Role[] = ["SUPER_ADMIN", "QUAN_LY_DAI_LY", "NHAN_VIEN_BAN"];
export const CUSTOMER_MANAGER_ROLES: Role[] = ["SUPER_ADMIN", "QUAN_LY_DAI_LY", "NHAN_VIEN_BAN"];
export const USER_MANAGER_ROLES: Role[] = ["SUPER_ADMIN"];
export const AUDIT_VIEWER_ROLES: Role[] = ["SUPER_ADMIN"];
export const DASHBOARD_VIEWER_ROLES: Role[] = ADMIN_ROLES;
export const PRICE_ALERT_MANAGER_ROLES: Role[] = ["SUPER_ADMIN", "QUAN_LY_DAI_LY"];
export const REVENUE_REPORT_ROLES: Role[] = ADMIN_ROLES;

export interface AdminNavItem {
  label: string;
  href?: string;
  description: string;
  roles: Role[];
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  QUAN_LY_DAI_LY: "Quản lý đại lý",
  NHAN_VIEN_BAN: "Nhân viên bán",
  KE_TOAN: "Kế toán",
};

export function getRoleLabel(role: Role): string {
  return ROLE_LABELS[role];
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    label: "Overview",
    href: "/admin/dashboard",
    description: "KPI booking, doanh thu, lợi nhuận và công nợ hiện tại.",
    roles: DASHBOARD_VIEWER_ROLES,
  },
  {
    label: "Bookings",
    href: "/admin/bookings",
    description: "Danh sách booking để kiểm tra hold pipeline và lifecycle.",
    roles: ADMIN_ROLES,
  },
  {
    label: "Customers",
    href: "/admin/customers",
    description: "Tra cứu, cập nhật, blacklist và merge khách hàng trùng.",
    roles: ADMIN_ROLES,
  },
  {
    label: "QR Payments",
    href: "/admin/payments",
    description: "Theo dõi QR payOS, webhook auto-match và các giao dịch cần manual review.",
    roles: ADMIN_ROLES,
  },
  {
    label: "Price Alerts",
    href: "/admin/price-alerts",
    description: "Theo dõi ngưỡng giá theo chặng bay và nhận cảnh báo nội bộ.",
    roles: ADMIN_ROLES,
  },
  {
    label: "Revenue Reports",
    href: "/admin/reports/revenue",
    description: "So sánh booking date, issue date và payment date cho vận hành và kế toán.",
    roles: REVENUE_REPORT_ROLES,
  },
  {
    label: "Markup Rules",
    href: "/admin/markup-rules",
    description: "Markup rules CRUD và cấu hình áp giá.",
    roles: MARKUP_RULE_MANAGER_ROLES,
  },
  {
    label: "Audit Log",
    href: "/admin/audit",
    description: "Theo dõi lịch sử thay đổi nghiệp vụ và phân quyền.",
    roles: AUDIT_VIEWER_ROLES,
  },
  {
    label: "Users",
    href: "/admin/users",
    description: "Quản trị tài khoản nội bộ, role và reset mật khẩu.",
    roles: USER_MANAGER_ROLES,
  },
];
