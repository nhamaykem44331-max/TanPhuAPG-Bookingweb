"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, X } from "lucide-react";

import { OflyMark } from "@/components/admin/shell/OflyMark";
import { isNavItemActive, type AdminNavGroup, type AdminNavKey } from "@/lib/admin/nav";

interface SidebarUser {
  fullName: string;
  roleLabel: string;
  initial: string;
}

interface SidebarProps {
  groups: AdminNavGroup[];
  badges: Partial<Record<AdminNavKey, number>>;
  user: SidebarUser;
  logoutAction: () => void | Promise<void>;
  onNavigate?: () => void;
  onClose?: () => void;
}

export function Sidebar({ groups, badges, user, logoutAction, onNavigate, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[248px] flex-none flex-col border-r border-[var(--line)] bg-[var(--bg)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-[22px] pb-[18px] pt-6">
        <div>
          <OflyMark />
          <div className="ofly-eyebrow mt-[9px] tracking-[2.5px]">ADMIN · XUẤT VÉ</div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng menu"
            className="rounded-md p-1.5 text-[var(--ink-soft)] transition hover:text-[var(--ink)] lg:hidden"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3.5">
        {groups.map((group) => (
          <div key={group.title} className="mb-4">
            <div className="ofly-eyebrow px-2.5 pb-[7px]">{group.title}</div>
            {group.items.map((item) => {
              const active = isNavItemActive(pathname, item.href);
              const badge = item.badgeKey ? badges[item.badgeKey] : undefined;

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={onNavigate}
                  className="mb-0.5 flex items-center justify-between gap-2 px-3 py-[9px] text-[13px] transition-colors"
                  style={{
                    borderLeft: `2px solid ${active ? "var(--rust)" : "transparent"}`,
                    borderRadius: "0 7px 7px 0",
                    background: active ? "var(--surface-2)" : "transparent",
                    color: active ? "var(--ink)" : "var(--ink-soft)",
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  <span className="truncate">{item.label}</span>
                  {typeof badge === "number" && badge > 0 ? (
                    <span
                      className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] px-[5px] text-[10px] font-semibold"
                      style={{
                        background: "var(--tone-rust-bg)",
                        color: "var(--tone-rust-fg)",
                        border: "1px solid var(--tone-rust-bd)",
                      }}
                    >
                      {badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-[11px] border-t border-[var(--line)] px-4 py-3.5">
        <div
          className="ofly-serif flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-[15px] font-medium"
          style={{ border: "1px solid var(--rust)", color: "var(--rust)" }}
        >
          {user.initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">{user.fullName}</div>
          <div className="text-[11px] text-[var(--ink-soft)]">{user.roleLabel}</div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            aria-label="Đăng xuất"
            className="rounded-md p-2 text-[var(--ink-faint)] transition hover:bg-[var(--surface-2)] hover:text-[var(--rust)]"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      </div>
    </aside>
  );
}
