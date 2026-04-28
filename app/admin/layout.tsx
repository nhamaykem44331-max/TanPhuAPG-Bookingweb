import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import { Inter, JetBrains_Mono } from "next/font/google";
import { LogOut, Search } from "lucide-react";

import { auth, signOut } from "@/auth";
import { AdminMobileMenu } from "@/components/admin/AdminMobileMenu";
import { AdminNavRail } from "@/components/admin/AdminNavRail";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { AdminTopbarActions } from "@/components/admin/AdminTopbarActions";
import { ADMIN_NAV_ITEMS, getRoleLabel } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";

interface AdminLayoutProps {
  children: ReactNode;
}

const adminSans = Inter({
  subsets: ["latin"],
  variable: "--font-admin-sans",
  display: "swap",
});

const adminMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-admin-mono",
  display: "swap",
});

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth();

  if (!session?.user?.id) {
    return <>{children}</>;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      fullName: true,
      role: true,
      active: true,
      email: true,
    },
  });

  if (!user?.active) {
    redirect("/admin/login?error=inactive");
  }

  async function logoutAction() {
    "use server";
    await signOut({ redirectTo: "/admin/login" });
  }

  const visibleItems = ADMIN_NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const roleLabel = getRoleLabel(user.role);
  const themeCookie = cookies().get("apg-admin-theme")?.value;
  const initialTheme = themeCookie === "light" ? "light" : "dark";
  const chromeUser = {
    fullName: user.fullName,
    email: user.email,
    roleLabel,
  };

  return (
    <div
      className={`${adminSans.variable} ${adminMono.variable} apg-admin-shell min-h-screen text-[var(--apg-text-primary)]`}
      data-admin-theme={initialTheme}
      lang="vi-VN"
    >
      <aside className="apg-admin-sidebar fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-[var(--apg-border-default)] bg-[var(--apg-bg-page)] lg:flex lg:flex-col">
        <div className="flex h-[64px] items-center gap-3 border-b border-[var(--apg-border-default)] px-5">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)]">
            <Image
              src="/assets/tanphu-apg-logo.jpg"
              alt="Tan Phu APG"
              width={32}
              height={32}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[var(--apg-text-primary)]">APG BOOKING MANAGER</div>
            <div className="text-[11px] text-[var(--apg-text-muted)]">Super Admin Console</div>
          </div>
        </div>

        <div className="border-b border-[var(--apg-border-default)] px-3 py-3">
          <div className="flex h-9 items-center gap-2 rounded-md border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-3 text-[var(--apg-text-muted)]">
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="flex-1 text-sm">Find...</span>
            <span className="rounded border border-[var(--apg-border-default)] px-1.5 py-0.5 text-[10px] font-medium">F</span>
          </div>
        </div>

        <AdminNavRail items={visibleItems} />

        <div className="mt-auto border-t border-[var(--apg-border-default)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-black">
              {user.fullName?.[0]?.toUpperCase() ?? "A"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-[var(--apg-text-primary)]">{user.fullName}</div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="rounded-full border border-[var(--apg-border-default)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--apg-text-muted)]">
                  {roleLabel}
                </span>
              </div>
            </div>
            <form action={logoutAction}>
              <button
                aria-label="Đăng xuất"
                className="rounded-md p-2 text-[var(--apg-text-muted)] transition hover:bg-[var(--apg-bg-surface-soft)] hover:text-[var(--apg-text-primary)]"
                type="submit"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[264px]">
        <header className="apg-admin-topbar sticky top-0 z-30 flex h-[52px] items-center justify-between border-b border-[var(--apg-border-default)] px-3 backdrop-blur-xl sm:px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-2 lg:hidden">
            <AdminMobileMenu items={visibleItems} user={chromeUser} logoutAction={logoutAction} />
            <Image
              src="/assets/tanphu-apg-logo.jpg"
              alt="Tan Phu APG"
              width={28}
              height={28}
              className="rounded-full object-cover"
              priority
            />
            <span className="truncate text-sm font-semibold">APG BOOKING MANAGER</span>
          </div>

          <AdminTopbar items={visibleItems} />
          <AdminTopbarActions user={chromeUser} initialTheme={initialTheme} logoutAction={logoutAction} />
        </header>

        <main className="mx-auto w-full max-w-[1520px] px-3 py-5 sm:px-5 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
