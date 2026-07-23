"use client";

import { Moon, Sun } from "lucide-react";

import { useOflyTheme } from "@/components/admin/shell/theme-context";

// Đổi giao diện Sáng/Tối — nay là MỘT MỤC trong menu tài khoản (đáy sidebar),
// nên tạo hình giống hàng menu chứ không còn là nút riêng trên topbar.
export function ThemeToggle() {
  const { theme, toggle } = useOflyTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Chuyển sang chế độ sáng (Ngày)" : "Chuyển sang chế độ tối (Đêm)"}
      className="flex w-full items-center gap-[11px] rounded-[7px] px-3 py-2.5 text-left transition-colors hover:bg-[var(--paper2)]"
      style={{ fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: 500, color: "var(--ink2)" }}
    >
      {isDark ? (
        <Sun size={16} strokeWidth={1.5} style={{ color: "var(--ink3)", flexShrink: 0 }} aria-hidden="true" />
      ) : (
        <Moon size={16} strokeWidth={1.5} style={{ color: "var(--ink3)", flexShrink: 0 }} aria-hidden="true" />
      )}
      <span>Giao diện {isDark ? "sáng" : "tối"}</span>
    </button>
  );
}
