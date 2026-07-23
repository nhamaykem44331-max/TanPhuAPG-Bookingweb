"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, ExternalLink, LogOut, MoreHorizontal } from "lucide-react";

import { AdminThemeToggle } from "@/components/admin/AdminThemeToggle";

type AdminTheme = "dark" | "light";

interface AdminTopbarActionsProps {
  user: {
    fullName: string;
    email: string;
    roleLabel: string;
  };
  initialTheme: AdminTheme;
  logoutAction: () => void | Promise<void>;
}

export function AdminTopbarActions({ user, initialTheme, logoutAction }: AdminTopbarActionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex items-center gap-1.5">
      <AdminThemeToggle initialTheme={initialTheme} />

      <Link
        aria-label="Mở cảnh báo giá"
        className="relative rounded-md p-2 text-[var(--ink3)] transition hover:bg-[var(--paper2)] hover:text-[var(--ink)]"
        href="/admin/price-alerts"
        title="Cảnh báo giá"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--tone-info-solid)]" />
      </Link>

      <button
        aria-label="Mở menu tài khoản"
        className="rounded-md p-2 text-[var(--ink3)] transition hover:bg-[var(--paper2)] hover:text-[var(--ink)]"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>

      {open ? (
        <div className="absolute right-0 top-10 z-50 w-72 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--paper)] shadow-2xl">
          <div className="border-b border-[var(--line)] px-4 py-3">
            <div className="truncate text-sm font-semibold text-[var(--ink)]">{user.fullName}</div>
            <div className="mt-0.5 truncate text-xs text-[var(--ink3)]">{user.email}</div>
            <div className="mt-2 inline-flex rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--ink3)]">
              {user.roleLabel}
            </div>
          </div>

          <div className="p-1">
            <Link
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--ink2)] hover:bg-[var(--paper2)] hover:text-[var(--ink)]"
              href="/"
              onClick={() => setOpen(false)}
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Mở khu đặt vé
            </Link>
            <Link
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--ink2)] hover:bg-[var(--paper2)] hover:text-[var(--ink)]"
              href="/admin/price-alerts"
              onClick={() => setOpen(false)}
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              Cảnh báo giá
            </Link>
          </div>

          <form action={logoutAction} className="border-t border-[var(--line)] p-1">
            <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-[var(--red)] hover:bg-[var(--tone-red-bg)]" type="submit">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Đăng xuất
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
