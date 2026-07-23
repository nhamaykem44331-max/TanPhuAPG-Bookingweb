"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ICONS } from "@/components/admin/shell/nav-icons";
import {
  isNavItemActive,
  workspaceOfPath,
  type AdminNav,
  type AdminNavItem,
  type AdminNavKey,
} from "@/lib/admin/nav";

// Sub-nav NGANG (Manager: `TopSubNav` trong shell.tsx) — mục con của không gian
// đang mở. Sidebar chỉ còn chuyển KHÔNG GIAN, còn màn cụ thể chọn ở dải pills này.
// Ẩn hoàn toàn khi route không thuộc không gian nào (vd Tổng quan).

interface TopSubNavProps {
  nav: AdminNav;
  badges: Partial<Record<AdminNavKey, number>>;
}

export function TopSubNav({ nav, badges }: TopSubNavProps) {
  const pathname = usePathname();
  const current = workspaceOfPath(pathname);
  if (!current) return null;

  // Lấy bản đã lọc theo role để không lộ mục ngoài quyền.
  const workspace = nav.workspaces.find((ws) => ws.id === current.id);
  if (!workspace || workspace.items.length === 0) return null;

  const WorkspaceIcon = NAV_ICONS[workspace.icon];

  return (
    <div
      className="sticky top-0 z-30 border-b border-[var(--line)]"
      style={{
        background: "color-mix(in srgb, var(--canvas) 86%, transparent)",
        backdropFilter: "saturate(1.4) blur(12px)",
        WebkitBackdropFilter: "saturate(1.4) blur(12px)",
      }}
    >
      <div className="mx-auto flex h-[60px] max-w-[1440px] items-center gap-[14px] px-4 sm:px-6 lg:px-[34px]">
        <span className="inline-flex flex-none items-center gap-[9px]">
          <span
            style={{
              width: 30,
              height: 30,
              flexShrink: 0,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--rustTint)",
              color: "var(--rust)",
            }}
          >
            <WorkspaceIcon size={17} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <span
            className="hidden sm:inline"
            style={{
              fontFamily: "var(--sans)",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "1.4px",
              textTransform: "uppercase",
              // Eyebrow theo hợp đồng là --ink3; --ink4 quá mờ trên nền --canvas.
              color: "var(--ink3)",
              whiteSpace: "nowrap",
            }}
          >
            {workspace.label}
          </span>
        </span>
        <span style={{ width: 1, height: 26, flexShrink: 0, background: "var(--line2)" }} />
        <div className="ofly-hscroll flex items-center gap-[5px] overflow-x-auto py-1.5">
          {workspace.items.map((item) => (
            <SubNavPill
              key={item.key}
              item={item}
              active={isNavItemActive(pathname, item.href)}
              badge={item.badgeKey ? badges[item.badgeKey] : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SubNavPill({ item, active, badge }: { item: AdminNavItem; active: boolean; badge?: number }) {
  const Icon = NAV_ICONS[item.icon];

  return (
    <Link
      href={item.href}
      title={item.label}
      aria-current={active ? "page" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 13px",
        borderRadius: 9,
        border: `1px solid ${active ? "var(--line2)" : "transparent"}`,
        background: active ? "var(--paper)" : "transparent",
        whiteSpace: "nowrap",
        flexShrink: 0,
        transition: "all 0.13s",
      }}
      onMouseEnter={(event) => {
        if (!active) event.currentTarget.style.background = "var(--paper2)";
      }}
      onMouseLeave={(event) => {
        if (!active) event.currentTarget.style.background = "transparent";
      }}
    >
      <Icon
        size={16}
        strokeWidth={active ? 1.9 : 1.5}
        aria-hidden="true"
        style={{ flexShrink: 0, color: active ? "var(--rust)" : "var(--ink3)" }}
      />
      <span
        style={{
          fontFamily: "var(--sans)",
          fontSize: 13,
          fontWeight: active ? 600 : 500,
          color: active ? "var(--ink)" : "var(--ink2)",
          letterSpacing: "0.1px",
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
        }}
      >
        {item.star ? (
          <span style={{ width: 5, height: 5, flexShrink: 0, borderRadius: "50%", background: "var(--rustSoft)" }} />
        ) : null}
        {item.label}
      </span>
      {typeof badge === "number" && badge > 0 ? (
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            fontWeight: 600,
            minWidth: 19,
            textAlign: "center",
            padding: "1px 6px",
            borderRadius: 100,
            // Nền navy đặc (không đảo màu ở theme tối) để chữ --onInk luôn đủ tương phản;
            // dùng --rust thì ở theme tối nền hoá xanh nhạt, chữ 11px không đọc nổi.
            background: active ? "var(--navyMid)" : "var(--paper3)",
            color: active ? "var(--onInk)" : "var(--ink3)",
            border: active ? "none" : "1px solid var(--line2)",
          }}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
