"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type AdminTheme = "dark" | "light";

interface AdminThemeToggleProps {
  initialTheme: AdminTheme;
}

const STORAGE_KEY = "apg-admin-theme";
const COOKIE_KEY = "apg-admin-theme";

function applyTheme(theme: AdminTheme) {
  const shell = document.querySelector<HTMLElement>(".apg-admin-shell");

  if (shell) {
    shell.dataset.adminTheme = theme;
  }

  document.documentElement.dataset.adminTheme = theme;
}

function persistTheme(theme: AdminTheme) {
  window.localStorage.setItem(STORAGE_KEY, theme);
  document.cookie = `${COOKIE_KEY}=${theme}; path=/admin; max-age=31536000; SameSite=Lax`;
}

function readStoredTheme(initialTheme: AdminTheme): AdminTheme {
  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (stored === "dark" || stored === "light") {
    return stored;
  }

  return initialTheme;
}

export function AdminThemeToggle({ initialTheme }: AdminThemeToggleProps) {
  const [theme, setTheme] = useState<AdminTheme>(initialTheme);

  useEffect(() => {
    const storedTheme = readStoredTheme(initialTheme);
    setTheme(storedTheme);
    applyTheme(storedTheme);
    persistTheme(storedTheme);
  }, [initialTheme]);

  const nextTheme = theme === "dark" ? "light" : "dark";
  const label = theme === "dark" ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối";

  return (
    <button
      aria-label={label}
      className="rounded-md p-2 text-[var(--apg-text-muted)] transition hover:bg-[var(--apg-bg-surface-soft)] hover:text-[var(--apg-text-primary)]"
      title={label}
      type="button"
      onClick={() => {
        setTheme(nextTheme);
        applyTheme(nextTheme);
        persistTheme(nextTheme);
      }}
    >
      {theme === "dark" ? <Moon className="h-4 w-4" aria-hidden="true" /> : <Sun className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}
