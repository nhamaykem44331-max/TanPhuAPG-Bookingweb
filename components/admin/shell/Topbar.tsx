"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";

import { ThemeToggle } from "@/components/admin/shell/ThemeToggle";
import { resolvePageHeader } from "@/lib/admin/nav";

interface TopbarProps {
  onOpenMobile: () => void;
}

export function Topbar({ onOpenMobile }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { eyebrow, title } = resolvePageHeader(pathname);
  const [search, setSearch] = useState("");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    router.push(query ? `/admin/bookings?q=${encodeURIComponent(query)}` : "/admin/bookings");
  }

  return (
    <header
      className="sticky top-0 z-10 flex items-center justify-between gap-6 border-b border-[var(--line)] px-4 py-3.5 sm:px-6 lg:px-[34px] lg:py-[18px]"
      style={{
        background: "color-mix(in srgb, var(--bg) 88%, transparent)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Mở menu"
          className="rounded-md p-2 text-[var(--ink-soft)] transition hover:text-[var(--ink)] lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <div className="ofly-eyebrow mb-[7px] tracking-[2.5px]">{eyebrow}</div>
          <h1
            className="ofly-serif truncate leading-none"
            style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.4px" }}
          >
            {title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <form
          onSubmit={onSubmit}
          className="hidden items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-[11px] py-2 md:flex md:w-[230px]"
        >
          <Search className="h-[15px] w-[15px] flex-none text-[var(--ink-faint)]" aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm PNR, chặng, khách…"
            aria-label="Tìm đơn"
            className="w-full border-none bg-transparent text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
          />
        </form>
        <ThemeToggle />
      </div>
    </header>
  );
}
