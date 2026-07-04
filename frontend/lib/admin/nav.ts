import type { Role } from "@prisma/client";

import {
  ADMIN_ROLES,
  AUDIT_VIEWER_ROLES,
  DASHBOARD_VIEWER_ROLES,
  MARKUP_RULE_MANAGER_ROLES,
  PAYMENT_CAPTURE_ROLES,
  RMS_HANDOFF_ROLES,
  TICKETING_QUEUE_ROLES,
  USER_MANAGER_ROLES,
} from "@/lib/auth/constants";

// OpenFly sidebar (HANDOFF Phần J + parity với file thiết kế): 5 nhóm, mỗi mục có
// badge tuỳ chọn (queue count, manual-review count). Role-gating tái dùng các nhóm role
// đã định nghĩa cho backend Phần F nên quyền xem UI khớp quyền gọi API.

export type AdminNavKey =
  | "queue"
  | "orders"
  | "quote"
  | "dashboard"
  | "payments"
  | "notifications"
  | "funnel"
  | "markup"
  | "handoff"
  | "audit"
  | "users";

export interface AdminNavItem {
  key: AdminNavKey;
  label: string;
  href: string;
  roles: Role[];
  /** Key vào bản đồ badge số (vd queue đếm PAID+TICKETING). */
  badgeKey?: AdminNavKey;
}

export interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    title: "VẬN HÀNH",
    items: [
      { key: "queue", label: "Hàng đợi xuất vé", href: "/admin/queue", roles: TICKETING_QUEUE_ROLES, badgeKey: "queue" },
      { key: "orders", label: "Tất cả đơn", href: "/admin/bookings", roles: ADMIN_ROLES },
      { key: "quote", label: "Lập báo giá", href: "/admin/quote", roles: ADMIN_ROLES },
      { key: "dashboard", label: "Dashboard", href: "/admin/dashboard", roles: DASHBOARD_VIEWER_ROLES },
    ],
  },
  {
    title: "THANH TOÁN & GIAO TIẾP",
    items: [
      { key: "payments", label: "Khớp thanh toán", href: "/admin/payments", roles: PAYMENT_CAPTURE_ROLES, badgeKey: "payments" },
      { key: "notifications", label: "Thông báo Zalo", href: "/admin/notifications", roles: ADMIN_ROLES },
    ],
  },
  {
    title: "PHÂN TÍCH",
    items: [{ key: "funnel", label: "Phễu vận hành", href: "/admin/funnel", roles: DASHBOARD_VIEWER_ROLES }],
  },
  {
    title: "CẤU HÌNH",
    items: [
      { key: "markup", label: "Markup & hiển thị", href: "/admin/markup", roles: MARKUP_RULE_MANAGER_ROLES },
      { key: "handoff", label: "Bàn giao RMS", href: "/admin/handoff", roles: RMS_HANDOFF_ROLES },
    ],
  },
  {
    title: "HỆ THỐNG",
    items: [
      { key: "audit", label: "Audit log", href: "/admin/audit", roles: AUDIT_VIEWER_ROLES },
      { key: "users", label: "Phân quyền", href: "/admin/users", roles: USER_MANAGER_ROLES },
    ],
  },
];

export function navGroupsForRole(role: Role): AdminNavGroup[] {
  return ADMIN_NAV_GROUPS.map((group) => ({
    title: group.title,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}

export interface AdminPageHeader {
  eyebrow: string;
  title: string;
}

// Bản đồ tiêu đề topbar theo segment đầu sau /admin (parity với `titles` trong file thiết kế).
const PAGE_HEADERS: Record<string, AdminPageHeader> = {
  queue: { eyebrow: "HÀNG ĐỢI · ƯU TIÊN CAO", title: "Hàng đợi xuất vé" },
  bookings: { eyebrow: "VẬN HÀNH", title: "Tất cả đơn" },
  quote: { eyebrow: "CÔNG CỤ", title: "Lập báo giá" },
  dashboard: { eyebrow: "TỔNG QUAN VẬN HÀNH", title: "Dashboard" },
  payments: { eyebrow: "ĐỐI SOÁT", title: "Khớp thanh toán" },
  notifications: { eyebrow: "GIAO TIẾP", title: "Thông báo Zalo" },
  funnel: { eyebrow: "PHÂN TÍCH", title: "Phễu vận hành" },
  markup: { eyebrow: "CẤU HÌNH GIÁ", title: "Markup & hiển thị web" },
  handoff: { eyebrow: "BÀN GIAO", title: "Bàn giao sang RMS" },
  audit: { eyebrow: "NHẬT KÝ", title: "Audit log" },
  users: { eyebrow: "HỆ THỐNG", title: "Phân quyền" },
};

const DETAIL_HEADERS: Record<string, AdminPageHeader> = {
  bookings: { eyebrow: "CHI TIẾT ĐƠN", title: "Chi tiết đơn" },
};

export function resolvePageHeader(pathname: string): AdminPageHeader {
  const segments = pathname.replace(/^\/admin\/?/, "").split("/").filter(Boolean);
  const [root, child] = segments;

  if (!root) {
    return { eyebrow: "QUẢN TRỊ", title: "Tổng quan" };
  }

  if (child && DETAIL_HEADERS[root]) {
    return DETAIL_HEADERS[root];
  }

  return PAGE_HEADERS[root] ?? { eyebrow: "QUẢN TRỊ", title: "Quản trị" };
}

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
