"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { resolvePageHeader } from "@/lib/admin/nav";

// Topbar rút gọn: ô tìm kiếm đã chuyển vào sidebar, nút đổi giao diện vào menu
// tài khoản. Còn lại đúng vai trò PageHead của Manager (eyebrow + tiêu đề) và
// nút mở drawer trên mobile. KHÔNG sticky nữa để TopSubNav ngay dưới được dính đỉnh.

interface TopbarProps {
  onOpenMobile: () => void;
}

export function Topbar({ onOpenMobile }: TopbarProps) {
  const pathname = usePathname();
  const { eyebrow, title } = resolvePageHeader(pathname);

  return (
    <header className="flex-none">
      <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 pb-[18px] pt-[22px] sm:px-6 lg:px-[34px] lg:pb-5 lg:pt-7">
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Mở menu"
          className="flex min-h-[44px] min-w-[44px] flex-none items-center justify-center rounded-md text-[var(--ink2)] transition hover:text-[var(--ink)] lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <div className="ofly-eyebrow mb-[9px] flex items-center gap-2 tracking-[2.5px]">
            <span aria-hidden="true" style={{ color: "var(--rust)" }}>
              —
            </span>
            <span className="truncate">{eyebrow}</span>
          </div>
          <h1
            className="ofly-serif truncate text-[26px] leading-[1.05] lg:text-[33px]"
            style={{ fontWeight: 500, letterSpacing: "-0.8px" }}
          >
            {title}
          </h1>
        </div>
      </div>
    </header>
  );
}
