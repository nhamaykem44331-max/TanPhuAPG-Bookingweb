"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { ChevronDown, LogOut } from "lucide-react";

import { NAV_ICONS } from "@/components/admin/shell/nav-icons";
import { ThemeToggle } from "@/components/admin/shell/ThemeToggle";
import type { AdminNavItem } from "@/lib/admin/nav";

// Khối tài khoản ở ĐÁY sidebar (Manager: AccountBlock trong shell.tsx).
// Đây là nơi DUY NHẤT chứa mục hệ thống (Audit log / Phân quyền), nút đổi
// giao diện và Đăng xuất — topbar không còn giữ mấy thứ đó nữa.

interface AccountBlockUser {
  fullName: string;
  email: string;
  roleLabel: string;
  initial: string;
}

interface AccountBlockProps {
  collapsed: boolean;
  user: AccountBlockUser;
  system: AdminNavItem[];
  logoutAction: () => void | Promise<void>;
  onNavigate?: () => void;
}

const menuItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 11,
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 7,
  fontFamily: "var(--sans)",
  fontSize: 13.5,
  fontWeight: 500,
  color: "var(--ink2)",
};

export function AccountBlock({ collapsed, user, system, logoutAction, onNavigate }: AccountBlockProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      style={{
        flexShrink: 0,
        position: "relative",
        borderTop: "1px solid var(--line)",
        padding: collapsed ? "10px 0" : "10px 12px",
      }}
    >
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="Tài khoản"
        aria-expanded={menuOpen}
        title={collapsed ? user.fullName : undefined}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: collapsed ? "8px 0" : "8px 10px",
          justifyContent: collapsed ? "center" : "flex-start",
          borderRadius: 9,
          border: `1px solid ${menuOpen ? "var(--line2)" : "transparent"}`,
          background: menuOpen ? "var(--paper2)" : "transparent",
          transition: "background 0.13s",
        }}
        onMouseEnter={(event) => {
          if (!menuOpen) event.currentTarget.style.background = "var(--paper2)";
        }}
        onMouseLeave={(event) => {
          if (!menuOpen) event.currentTarget.style.background = "transparent";
        }}
      >
        <span
          style={{
            width: 30,
            height: 30,
            flexShrink: 0,
            borderRadius: "50%",
            background: "var(--gradNavy)",
            color: "#FFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--serif)",
            fontSize: 12.5,
            fontStyle: "italic",
            fontWeight: 600,
          }}
        >
          {user.initial}
        </span>
        {collapsed ? null : (
          <>
            <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <span
                className="block truncate"
                style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}
              >
                {user.fullName}
              </span>
              <span
                className="block truncate"
                style={{ fontFamily: "var(--sans)", fontSize: 10.5, color: "var(--ink3)" }}
              >
                {user.roleLabel}
              </span>
            </span>
            <ChevronDown
              size={14}
              aria-hidden="true"
              style={{
                flexShrink: 0,
                color: "var(--ink3)",
                transform: menuOpen ? "rotate(180deg)" : "none",
                transition: "transform 0.18s",
              }}
            />
          </>
        )}
      </button>

      {menuOpen ? (
        <>
          {/* Lớp phủ trong suốt: bấm ra ngoài là đóng menu */}
          <div
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
            style={{ position: "fixed", inset: 0, zIndex: 70 }}
          />
          <div
            className="ofly-modal-in"
            style={{
              position: "absolute",
              bottom: "calc(100% - 2px)",
              // Sidebar thu gọn chỉ rộng 72px nên menu phải tràn ra ngoài mới đọc được.
              ...(collapsed ? { left: 8, width: 218 } : { left: 12, right: 12 }),
              zIndex: 71,
              overflow: "hidden",
              background: "var(--paper)",
              border: "1px solid var(--line2)",
              borderRadius: 12,
              boxShadow: "0 -10px 40px -16px rgba(20,17,16,0.4)",
            }}
          >
            <div style={{ padding: "13px 15px", borderBottom: "1px solid var(--line)" }}>
              <div
                className="truncate"
                style={{ fontFamily: "var(--sans)", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}
              >
                {user.fullName}
              </div>
              <div
                className="truncate"
                style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink3)", marginTop: 2 }}
              >
                {user.email}
              </div>
            </div>
            <div style={{ padding: 6 }}>
              {system.map((item) => {
                const Icon = NAV_ICONS[item.icon];
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => {
                      setMenuOpen(false);
                      onNavigate?.();
                    }}
                    className="transition-colors hover:bg-[var(--paper2)]"
                    style={menuItemStyle}
                  >
                    <Icon size={16} strokeWidth={1.5} style={{ color: "var(--ink3)", flexShrink: 0 }} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              {system.length > 0 ? (
                <div style={{ height: 1, background: "var(--line)", margin: "6px 8px" }} />
              ) : null}
              <ThemeToggle />
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="transition-colors hover:bg-[var(--paper2)]"
                  style={{ ...menuItemStyle, color: "var(--red)" }}
                >
                  <LogOut size={16} strokeWidth={1.5} style={{ flexShrink: 0 }} aria-hidden="true" />
                  <span>Đăng xuất</span>
                </button>
              </form>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
