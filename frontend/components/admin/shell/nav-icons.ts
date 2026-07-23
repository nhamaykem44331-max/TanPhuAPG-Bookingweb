import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  FileText,
  Filter,
  LayoutGrid,
  ListChecks,
  Plane,
  Scale,
  ScrollText,
  Send,
  Settings,
  Tags,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";

import type { AdminNavIcon } from "@/lib/admin/nav";

// Map tên icon (chuỗi trong lib/admin/nav.ts) → component lucide. Tách riêng ở đây vì
// registry nav phải giữ dạng dữ liệu thuần để đi qua ranh giới RSC server→client;
// component chỉ được phân giải Ở PHÍA CLIENT (Sidebar/TopSubNav/AccountBlock).
// Thêm icon mới: thêm tên vào AdminNavIcon rồi thêm cặp tương ứng vào đây —
// Record<AdminNavIcon, ...> sẽ báo lỗi biên dịch nếu thiếu.
export const NAV_ICONS: Record<AdminNavIcon, LucideIcon> = {
  "layout-grid": LayoutGrid,
  plane: Plane,
  wallet: Wallet,
  "bar-chart": BarChart3,
  settings: Settings,
  "list-checks": ListChecks,
  ticket: Ticket,
  "file-text": FileText,
  scale: Scale,
  bell: Bell,
  filter: Filter,
  tags: Tags,
  send: Send,
  "scroll-text": ScrollText,
  users: Users,
};
