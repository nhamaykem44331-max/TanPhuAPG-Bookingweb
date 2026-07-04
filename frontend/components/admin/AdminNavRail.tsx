"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BellRing,
  BookOpenCheck,
  CreditCard,
  FileBarChart,
  Gauge,
  History,
  Plane,
  SlidersHorizontal,
  Users,
  WalletCards,
} from "lucide-react";

import type { AdminNavItem } from "@/lib/auth/constants";

interface AdminNavRailProps {
  items: AdminNavItem[];
}

type NavGroup = "Overview" | "Operations" | "Revenue" | "Governance";

const GROUP_ORDER: NavGroup[] = ["Overview", "Operations", "Revenue", "Governance"];

function matchesPath(pathname: string, href?: string): boolean {
  if (!href) {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupForHref(href?: string): NavGroup {
  if (href?.includes("/dashboard")) return "Overview";
  if (href?.includes("/observability")) return "Overview";
  if (href?.includes("/reports") || href?.includes("/markup-rules")) return "Revenue";
  if (href?.includes("/audit") || href?.includes("/users")) return "Governance";
  return "Operations";
}

function IconForHref({ href, active }: { href?: string; active: boolean }) {
  const className = `h-4 w-4 ${active ? "text-[var(--apg-text-primary)]" : "text-[var(--apg-text-muted)]"}`;

  if (href?.includes("/dashboard")) return <Gauge className={className} aria-hidden="true" />;
  if (href?.includes("/observability")) return <Activity className={className} aria-hidden="true" />;
  if (href?.includes("/bookings")) return <Plane className={className} aria-hidden="true" />;
  if (href?.includes("/customers")) return <Users className={className} aria-hidden="true" />;
  if (href?.includes("/payments")) return <CreditCard className={className} aria-hidden="true" />;
  if (href?.includes("/markup-rules")) return <SlidersHorizontal className={className} aria-hidden="true" />;
  if (href?.includes("/audit")) return <History className={className} aria-hidden="true" />;
  if (href?.includes("/users")) return <WalletCards className={className} aria-hidden="true" />;
  if (href?.includes("/price-alerts")) return <BellRing className={className} aria-hidden="true" />;
  if (href?.includes("/reports")) return <FileBarChart className={className} aria-hidden="true" />;
  return <BookOpenCheck className={className} aria-hidden="true" />;
}

export function AdminNavRail({ items }: AdminNavRailProps) {
  const pathname = usePathname();
  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: items.filter((item) => groupForHref(item.href) === group),
  })).filter((group) => group.items.length > 0);

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      <div className="space-y-6">
        {grouped.map(({ group, items: groupItems }) => (
          <section key={group} className="space-y-1">
            {group !== "Overview" ? (
              <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--apg-text-muted)]">
                {group}
              </div>
            ) : null}

            {groupItems.map((item) => {
              const href = item.href ?? "/admin";
              const active = matchesPath(pathname, href);

              return (
                <Link
                  key={item.label}
                  href={href}
                  className={`apg-admin-nav-link group ${active ? "apg-admin-nav-link-active" : ""}`}
                  title={item.description}
                >
                  <IconForHref href={href} active={active} />
                  <span className="truncate">{item.label}</span>
                  {href.includes("/price-alerts") ? <Activity className="ml-auto h-3.5 w-3.5 text-cyan-400/80" aria-hidden="true" /> : null}
                </Link>
              );
            })}
          </section>
        ))}
      </div>
    </nav>
  );
}
