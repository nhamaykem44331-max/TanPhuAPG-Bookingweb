import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { auth } from "@/auth";
import { LoginForm } from "@/components/admin/LoginForm";
import { normalizeReturnTo } from "@/lib/auth/request";

interface AdminLoginPageProps {
  searchParams?: {
    error?: string | string[];
    returnTo?: string | string[];
  };
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

function getInitialErrorMessage(error: string | string[] | undefined): string | undefined {
  const errorCode = Array.isArray(error) ? error[0] : error;

  if (errorCode === "inactive") {
    return "Tài khoản đã bị khóa.";
  }

  return undefined;
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const session = await auth();

  if (session?.user) {
    redirect("/admin");
  }

  const returnTo = normalizeReturnTo(searchParams?.returnTo);
  const initialMessage = getInitialErrorMessage(searchParams?.error);

  return (
    <main className={`${adminSans.variable} ${adminMono.variable} apg-admin-shell min-h-screen overflow-hidden`}>
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_460px]">
        <section className="relative hidden border-r border-[var(--apg-border-default)] bg-[var(--apg-bg-page)] px-10 py-8 lg:flex lg:flex-col">
          <div className="flex items-center justify-between">
            <Link className="inline-flex items-center gap-2 text-sm text-[var(--apg-text-secondary)] transition hover:text-[var(--apg-text-primary)]" href="/">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Về khu đặt vé
            </Link>
            <span className="rounded-full border border-[var(--apg-border-default)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--apg-text-muted)]">
              Admin Access
            </span>
          </div>

          <div className="flex flex-1 items-center">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)]">
                  <Image
                    src="/assets/tanphu-apg-logo.jpg"
                    alt="Tan Phu APG"
                    width={44}
                    height={44}
                    className="h-full w-full object-cover"
                    priority
                  />
                </div>
                <div>
                  <div className="text-lg font-semibold text-[var(--apg-text-primary)]">APG BOOKING MANAGER</div>
                  <div className="text-sm text-[var(--apg-text-muted)]">Super Admin Console</div>
                </div>
              </div>

              <div className="mt-14">
                <p className="apg-eyebrow">Observability / Sign In</p>
                <h1 className="mt-4 max-w-2xl text-5xl font-semibold leading-[1.05] tracking-[-0.04em] text-[var(--apg-text-primary)]">
                  Bảng điều hành tối giản cho booking, QR và doanh thu.
                </h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-[var(--apg-text-secondary)]">
                  Đăng nhập để vận hành booking lifecycle, thanh toán payOS, khách hàng, markup, audit và báo cáo trong một console thống nhất.
                </p>
              </div>

              <div className="mt-12 grid max-w-3xl gap-3 md:grid-cols-3">
                {[
                  ["Session", "8 giờ", "Cookie quản trị riêng"],
                  ["Rate limit", "5 / 15 phút", "Giảm rủi ro brute-force"],
                  ["Audit", "Diff log", "Ghi lại mutation quan trọng"],
                ].map(([label, value, helper]) => (
                  <div key={label} className="rounded-xl border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--apg-text-muted)]">{label}</div>
                    <div className="mt-3 text-2xl font-semibold text-[var(--apg-text-primary)]">{value}</div>
                    <div className="mt-2 text-xs leading-5 text-[var(--apg-text-secondary)]">{helper}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-[var(--apg-text-muted)]">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Chỉ tài khoản nội bộ được cấp quyền mới truy cập được khu vực này.
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center bg-[var(--apg-bg-page)] px-5 py-8">
          <div className="w-full max-w-[380px]">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <Image
                src="/assets/tanphu-apg-logo.jpg"
                alt="Tan Phu APG"
                width={36}
                height={36}
                className="rounded-full object-cover"
                priority
              />
              <div>
                <div className="text-base font-semibold">APG BOOKING MANAGER</div>
                <div className="text-xs text-[var(--apg-text-muted)]">Admin Access</div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] p-6">
              <div className="mb-6">
                <p className="apg-eyebrow">Sign In</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--apg-text-primary)]">Đăng nhập</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--apg-text-secondary)]">
                  Dùng email nội bộ và mật khẩu đã được cấp. Hệ thống sẽ chuyển về trang đang yêu cầu sau khi xác thực.
                </p>
              </div>

              <LoginForm returnTo={returnTo} initialMessage={initialMessage} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
