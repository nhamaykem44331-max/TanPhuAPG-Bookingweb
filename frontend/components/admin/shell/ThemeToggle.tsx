"use client";

import { useOflyTheme } from "@/components/admin/shell/theme-context";

// ThemeToggle ở topbar — nhãn Ngày/Đêm (HANDOFF J.3).
export function ThemeToggle() {
  const { theme, toggle } = useOflyTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Chuyển sang chế độ sáng (Ngày)" : "Chuyển sang chế độ tối (Đêm)"}
      className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
    >
      <span aria-hidden="true">{isDark ? "☾" : "☀"}</span>
      <span>{isDark ? "Đêm" : "Ngày"}</span>
    </button>
  );
}
