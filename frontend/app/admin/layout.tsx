import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Be_Vietnam_Pro, Fraunces, JetBrains_Mono } from "next/font/google";
import { BookingStatus, PaymentIntentStatus } from "@prisma/client";

import { auth, signOut } from "@/auth";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import type { OflyTheme } from "@/components/admin/shell/theme-context";
import { adminNavForRole, type AdminNavKey } from "@/lib/admin/nav";
import { bookingListWhereForRole, type OwnershipContext } from "@/lib/auth/ownership";
import { getRoleLabel } from "@/lib/auth/constants";
import { getCurrentUserById } from "@/lib/auth/sessionUser";
import { prisma } from "@/lib/db";

import "./openfly.css";

interface AdminLayoutProps {
  children: ReactNode;
}

// Typography skin Tân Phú APG — ĐÚNG 3 font của Manager:
// Be Vietnam Pro (sans: UI/body/bảng) · Fraunces (serif: headline/số lớn)
// · JetBrains Mono (mono: PNR/mã/tiền trong ô KPI).
const oflySans = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-ofly-sans",
  display: "swap",
});

const oflySerif = Fraunces({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-ofly-serif",
  display: "swap",
});

const oflyMono = JetBrains_Mono({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "700"],
  variable: "--font-ofly-mono",
  display: "swap",
});

const QUEUE_STATUSES: BookingStatus[] = [BookingStatus.PAID, BookingStatus.TICKETING];

// Badge số trên sidebar: hàng đợi xuất vé (PAID+TICKETING) + thanh toán cần soát tay.
// Bọc try/catch để sự cố DB không bao giờ làm sập toàn bộ shell admin.
async function computeBadges(ctx: OwnershipContext): Promise<Partial<Record<AdminNavKey, number>>> {
  try {
    const queueWhere = bookingListWhereForRole(ctx, { status: { in: QUEUE_STATUSES } });
    const [queue, payments] = await Promise.all([
      prisma.booking.count({ where: queueWhere }),
      prisma.paymentIntent.count({
        where: {
          status: PaymentIntentStatus.MANUAL_REVIEW,
          ...(ctx.role === "NHAN_VIEN_BAN" ? { booking: { createdById: ctx.userId } } : {}),
        },
      }),
    ]);

    return { queue, payments };
  } catch {
    return {};
  }
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth();

  // Trang /admin/login render ngoài shell (chưa đăng nhập).
  if (!session?.user?.id) {
    return <>{children}</>;
  }

  const user = await getCurrentUserById(session.user.id);

  if (!user?.active) {
    redirect("/admin/login?error=inactive");
  }

  async function logoutAction() {
    "use server";
    await signOut({ redirectTo: "/admin/login" });
  }

  const ownership: OwnershipContext = { userId: user.id, role: user.role };
  const nav = adminNavForRole(user.role);
  const badges = await computeBadges(ownership);

  const themeCookie = cookies().get("ofly-theme")?.value;
  const initialTheme: OflyTheme = themeCookie === "dark" ? "dark" : "light";

  const shellUser = {
    fullName: user.fullName,
    email: user.email,
    roleLabel: getRoleLabel(user.role),
    initial: user.fullName?.trim()?.[0]?.toUpperCase() ?? "A",
  };

  return (
    <AdminShell
      user={shellUser}
      nav={nav}
      badges={badges}
      initialTheme={initialTheme}
      fontClassName={`${oflySans.variable} ${oflySerif.variable} ${oflyMono.variable}`}
      logoutAction={logoutAction}
    >
      {children}
    </AdminShell>
  );
}
