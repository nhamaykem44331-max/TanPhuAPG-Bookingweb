"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { Sidebar } from "@/components/admin/shell/Sidebar";
import { Topbar } from "@/components/admin/shell/Topbar";
import { OflyThemeContext, type OflyTheme } from "@/components/admin/shell/theme-context";
import type { AdminNavGroup, AdminNavKey } from "@/lib/admin/nav";

const STORAGE_KEY = "ofly-theme";

interface AdminShellUser {
  fullName: string;
  roleLabel: string;
  initial: string;
}

interface AdminShellProps {
  user: AdminShellUser;
  groups: AdminNavGroup[];
  badges: Partial<Record<AdminNavKey, number>>;
  initialTheme: OflyTheme;
  fontClassName: string;
  logoutAction: () => void | Promise<void>;
  children: ReactNode;
}

function persistTheme(theme: OflyTheme) {
  window.localStorage.setItem(STORAGE_KEY, theme);
  document.cookie = `${STORAGE_KEY}=${theme}; path=/admin; max-age=31536000; SameSite=Lax`;
}

export function AdminShell({
  user,
  groups,
  badges,
  initialTheme,
  fontClassName,
  logoutAction,
  children,
}: AdminShellProps) {
  const [theme, setTheme] = useState<OflyTheme>(initialTheme);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Reconcile với lựa chọn đã lưu (localStorage là nguồn sự thật phía client).
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      persistTheme(stored);
    } else {
      persistTheme(initialTheme);
    }
  }, [initialTheme]);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: OflyTheme = current === "dark" ? "light" : "dark";
      persistTheme(next);
      return next;
    });
  }, []);

  const themeValue = useMemo(() => ({ theme, toggle }), [theme, toggle]);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <OflyThemeContext.Provider value={themeValue}>
      <div
        className={`ofly ${theme === "dark" ? "theme-dark" : "theme-light"} ${fontClassName}`}
        lang="vi-VN"
      >
        <div className="hidden lg:flex">
          <Sidebar groups={groups} badges={badges} user={user} logoutAction={logoutAction} />
        </div>

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={closeMobile}
              aria-hidden="true"
            />
            <div className="absolute inset-y-0 left-0 shadow-xl">
              <Sidebar
                groups={groups}
                badges={badges}
                user={user}
                logoutAction={logoutAction}
                onNavigate={closeMobile}
                onClose={closeMobile}
              />
            </div>
          </div>
        ) : null}

        <main className="flex h-[100dvh] flex-1 flex-col overflow-y-auto">
          <Topbar onOpenMobile={() => setMobileOpen(true)} />
          <div className="flex-1 px-4 py-6 sm:px-6 lg:px-[34px] lg:pb-14 lg:pt-[30px]">{children}</div>
        </main>
      </div>
    </OflyThemeContext.Provider>
  );
}
