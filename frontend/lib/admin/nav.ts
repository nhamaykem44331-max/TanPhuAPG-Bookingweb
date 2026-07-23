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

// Điều hướng theo mô hình "KHÔNG GIAN LÀM VIỆC" của Tân Phú APG Manager
// (`apps/web/src/shell.tsx`): Tổng quan đứng riêng trên cùng · các không gian là tile
// trong sidebar · mục con của không gian đang mở hiện thành pills NGANG ở đầu vùng nội dung
// · mục hệ thống nằm trong menu tài khoản dưới đáy.
//
// Giữ nguyên URL, nhãn và role-gating cũ — chỉ đổi cách gom nhóm/hiển thị.

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

// ⚠ Icon là TÊN (chuỗi), không phải component lucide. File này được layout SERVER
// import rồi truyền `nav` qua prop cho AdminShell ("use client") — ranh giới RSC chỉ
// serialize được dữ liệu thuần; nhét hàm component vào đây từng làm sập toàn bộ layout
// sau đăng nhập (digest 3781830796). Map tên→component nằm ở shell/nav-icons.ts (client).
export type AdminNavIcon =
  | "layout-grid"
  | "plane"
  | "wallet"
  | "bar-chart"
  | "settings"
  | "list-checks"
  | "ticket"
  | "file-text"
  | "scale"
  | "bell"
  | "filter"
  | "tags"
  | "send"
  | "scroll-text"
  | "users";

export interface AdminNavItem {
  key: AdminNavKey;
  label: string;
  href: string;
  roles: Role[];
  icon: AdminNavIcon;
  /** Key vào bản đồ badge số (vd queue đếm PAID+TICKETING). */
  badgeKey?: AdminNavKey;
  /** Chấm nhỏ đánh dấu mục hay dùng (Manager: `star`). */
  star?: boolean;
}

export interface AdminWorkspace {
  id: string;
  label: string;
  icon: AdminNavIcon;
  items: AdminNavItem[];
}

/** Mục "nhà" — đứng riêng trên cùng sidebar, không thuộc không gian nào. */
export const ADMIN_HOME: AdminNavItem = {
  key: "dashboard",
  label: "Tổng quan",
  href: "/admin/dashboard",
  roles: DASHBOARD_VIEWER_ROLES,
  icon: "layout-grid",
};

export const ADMIN_WORKSPACES: AdminWorkspace[] = [
  {
    id: "ws_vanhanh",
    label: "Vận hành",
    icon: "plane",
    items: [
      {
        key: "queue",
        label: "Hàng đợi xuất vé",
        href: "/admin/queue",
        roles: TICKETING_QUEUE_ROLES,
        icon: "list-checks",
        badgeKey: "queue",
        star: true,
      },
      { key: "orders", label: "Tất cả đơn", href: "/admin/bookings", roles: ADMIN_ROLES, icon: "ticket" },
      { key: "quote", label: "Lập báo giá", href: "/admin/quote", roles: ADMIN_ROLES, icon: "file-text", star: true },
    ],
  },
  {
    id: "ws_thanhtoan",
    label: "Thanh toán",
    icon: "wallet",
    items: [
      {
        key: "payments",
        label: "Khớp thanh toán",
        href: "/admin/payments",
        roles: PAYMENT_CAPTURE_ROLES,
        icon: "scale",
        badgeKey: "payments",
      },
      { key: "notifications", label: "Thông báo Zalo", href: "/admin/notifications", roles: ADMIN_ROLES, icon: "bell" },
    ],
  },
  {
    id: "ws_phantich",
    label: "Phân tích",
    icon: "bar-chart",
    items: [
      { key: "funnel", label: "Phễu vận hành", href: "/admin/funnel", roles: DASHBOARD_VIEWER_ROLES, icon: "filter" },
    ],
  },
  {
    id: "ws_cauhinh",
    label: "Cấu hình",
    icon: "settings",
    items: [
      { key: "markup", label: "Markup & hiển thị", href: "/admin/markup", roles: MARKUP_RULE_MANAGER_ROLES, icon: "tags" },
      { key: "handoff", label: "Bàn giao RMS", href: "/admin/handoff", roles: RMS_HANDOFF_ROLES, icon: "send" },
    ],
  },
];

/** Mục hệ thống — Manager để trong menu tài khoản ở đáy sidebar, không phải nhóm riêng. */
export const ADMIN_SYSTEM_ITEMS: AdminNavItem[] = [
  { key: "audit", label: "Audit log", href: "/admin/audit", roles: AUDIT_VIEWER_ROLES, icon: "scroll-text" },
  { key: "users", label: "Phân quyền", href: "/admin/users", roles: USER_MANAGER_ROLES, icon: "users" },
];

export interface AdminNav {
  /** null khi role không được xem Tổng quan. */
  home: AdminNavItem | null;
  workspaces: AdminWorkspace[];
  system: AdminNavItem[];
}

export function adminNavForRole(role: Role): AdminNav {
  return {
    home: ADMIN_HOME.roles.includes(role) ? ADMIN_HOME : null,
    workspaces: ADMIN_WORKSPACES.map((ws) => ({
      ...ws,
      items: ws.items.filter((item) => item.roles.includes(role)),
    })).filter((ws) => ws.items.length > 0),
    system: ADMIN_SYSTEM_ITEMS.filter((item) => item.roles.includes(role)),
  };
}

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Không gian chứa route hiện tại — dùng để dựng sub-nav pills ngang. */
export function workspaceOfPath(pathname: string): AdminWorkspace | null {
  return (
    ADMIN_WORKSPACES.find((ws) => ws.items.some((item) => isNavItemActive(pathname, item.href))) ?? null
  );
}

export interface AdminPageHeader {
  eyebrow: string;
  title: string;
}

// Bản đồ tiêu đề trang theo segment đầu sau /admin.
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
  customers: { eyebrow: "KHÁCH HÀNG", title: "Khách hàng" },
  "price-alerts": { eyebrow: "CẢNH BÁO", title: "Cảnh báo giá" },
  "markup-rules": { eyebrow: "CẤU HÌNH GIÁ", title: "Quy tắc markup" },
  observability: { eyebrow: "GIÁM SÁT", title: "Web Vitals" },
};

const DETAIL_HEADERS: Record<string, AdminPageHeader> = {
  bookings: { eyebrow: "CHI TIẾT ĐƠN", title: "Chi tiết đơn" },
  customers: { eyebrow: "CHI TIẾT KHÁCH", title: "Hồ sơ khách hàng" },
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
