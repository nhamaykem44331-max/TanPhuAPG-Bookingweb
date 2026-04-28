"use client";

import { usePathname } from "next/navigation";

import type { AdminNavItem } from "@/lib/auth/constants";

interface AdminTopbarProps {
  items: AdminNavItem[];
}

function currentLabel(pathname: string, items: AdminNavItem[]): string {
  const active = items
    .filter((item) => item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`)))
    .sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0))[0];

  return active?.label ?? "Dashboard";
}

function currentGroup(pathname: string): string {
  if (pathname.includes("/bookings") || pathname.includes("/customers") || pathname.includes("/payments") || pathname.includes("/price-alerts")) {
    return "Operations";
  }

  if (pathname.includes("/reports") || pathname.includes("/markup-rules")) {
    return "Revenue";
  }

  if (pathname.includes("/audit") || pathname.includes("/users")) {
    return "Governance";
  }

  return "Observability";
}

export function AdminTopbar({ items }: AdminTopbarProps) {
  const pathname = usePathname();
  const label = currentLabel(pathname, items);
  const group = currentGroup(pathname);

  return (
    <div className="hidden min-w-0 flex-1 items-center justify-center text-sm lg:flex">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[var(--apg-text-muted)]">{group}</span>
        <span className="text-[var(--apg-border-strong)]">/</span>
        <span className="truncate font-semibold text-[var(--apg-text-primary)]">{label}</span>
      </div>
    </div>
  );
}
