"use client";

import { useState } from "react";
import Image from "next/image";
import { LogOut, Menu, X } from "lucide-react";

import { AdminNavRail } from "@/components/admin/AdminNavRail";
import type { AdminNavItem } from "@/lib/auth/constants";

interface AdminMobileMenuProps {
  items: AdminNavItem[];
  user: {
    fullName: string;
    email: string;
    roleLabel: string;
  };
  logoutAction: () => void | Promise<void>;
}

export function AdminMobileMenu({ items, user, logoutAction }: AdminMobileMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label="Mở menu quản trị"
        className="rounded-md p-2 text-[var(--apg-text-muted)] transition hover:bg-[var(--apg-bg-surface-soft)] hover:text-[var(--apg-text-primary)] lg:hidden"
        type="button"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Đóng menu" className="absolute inset-0 bg-black/70" type="button" onClick={() => setOpen(false)} />

          <aside className="relative flex h-full w-[86vw] max-w-[320px] flex-col border-r border-[var(--apg-border-default)] bg-[var(--apg-bg-page)]">
            <div className="flex h-[64px] items-center justify-between border-b border-[var(--apg-border-default)] px-4">
              <div className="flex items-center gap-3">
                <Image
                  src="/assets/tanphu-apg-logo.jpg"
                  alt="Tan Phu APG"
                  width={32}
                  height={32}
                  className="rounded-full object-cover"
                  priority
                />
                <div>
                  <div className="text-sm font-semibold text-[var(--apg-text-primary)]">APG BOOKING MANAGER</div>
                  <div className="text-xs text-[var(--apg-text-muted)]">Admin Console</div>
                </div>
              </div>

              <button
                aria-label="Đóng menu"
                className="rounded-md p-2 text-[var(--apg-text-muted)] hover:bg-[var(--apg-bg-surface-soft)] hover:text-[var(--apg-text-primary)]"
                type="button"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div onClick={() => setOpen(false)}>
              <AdminNavRail items={items} />
            </div>

            <div className="mt-auto border-t border-[var(--apg-border-default)] p-4">
              <div className="mb-3 min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--apg-text-primary)]">{user.fullName}</div>
                <div className="mt-1 truncate text-xs text-[var(--apg-text-muted)]">{user.email}</div>
                <div className="mt-2 inline-flex rounded-full border border-[var(--apg-border-default)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--apg-text-muted)]">
                  {user.roleLabel}
                </div>
              </div>

              <form action={logoutAction}>
                <button className="apg-btn-secondary flex w-full items-center justify-center gap-2" type="submit">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Đăng xuất
                </button>
              </form>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
