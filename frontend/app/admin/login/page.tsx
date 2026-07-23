import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Be_Vietnam_Pro, Fraunces, JetBrains_Mono } from "next/font/google";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { auth } from "@/auth";
import { LoginForm } from "@/components/admin/LoginForm";
import { MiniChip } from "@/components/admin/ui/Chip";
import { normalizeReturnTo } from "@/lib/auth/request";

interface AdminLoginPageProps {
  searchParams?: {
    error?: string | string[];
    returnTo?: string | string[];
  };
}

// Trang này render NGOÀI shell admin (layout trả children trần khi chưa đăng nhập),
// nên phải tự nạp đúng 3 font của skin Tân Phú APG và tự bọc `.ofly` để có token màu.
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

// Ba ô thông tin phiên/bảo mật — nội dung giữ nguyên như bản cũ.
const SECURITY_NOTES: Array<[string, string, string]> = [
  ["Session", "8 giờ", "Cookie quản trị riêng"],
  ["Rate limit", "5 / 15 phút", "Giảm rủi ro brute-force"],
  ["Audit", "Diff log", "Ghi lại mutation quan trọng"],
];

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

  // Theo đúng cookie theme mà AdminShell ghi, để màn đăng nhập không "chớp sáng"
  // trước khi vào shell tối.
  const isDark = cookies().get("ofly-theme")?.value === "dark";

  return (
    <div
      className={`ofly ${isDark ? "theme-dark" : "theme-light"} ${oflySans.variable} ${oflySerif.variable} ${oflyMono.variable}`}
      lang="vi-VN"
    >
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-10 sm:px-6">
        <div className="ofly-in mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center gap-[14px]">
          <div className="flex items-center justify-between gap-3">
            <Link
              className="inline-flex items-center gap-[7px] text-[13px] text-[var(--ink3)] transition-colors duration-150 hover:text-[var(--ink)]"
              href="/"
            >
              <ArrowLeft size={15} strokeWidth={1.5} aria-hidden="true" />
              Về khu đặt vé
            </Link>
            <MiniChip tone="muted">Admin Access</MiniChip>
          </div>

          {/* Thẻ đăng nhập — §3: bo 14px như Modal của Manager (khối nổi bật nhất trang) */}
          <div className="rounded-[14px] border border-[var(--line)] bg-[var(--paper)] px-[26px] py-[24px]">
            <div className="flex items-center gap-[11px]">
              <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--paper2)]">
                <Image
                  src="/assets/tanphu-apg-logo.jpg"
                  alt="Tan Phu APG"
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                  priority
                />
              </span>
              <span className="flex min-w-0 flex-col leading-none">
                <span className="text-[15px] font-extrabold tracking-[0.3px] text-[var(--ink)]">
                  Tân Phú <span className="text-[var(--rust)]">APG</span>
                </span>
                {/* 10px + --ink3 theo quy ước eyebrow §2: 8.5px/--ink4 tương phản quá thấp để đọc */}
                <span className="mt-[5px] text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--ink3)]">
                  APG Booking Manager · Super Admin Console
                </span>
              </span>
            </div>

            <div className="my-[20px] h-px bg-[var(--line)]" />

            <p className="ofly-eyebrow">Sign In</p>
            <h1 className="ofly-serif mt-[10px] text-[30px] font-medium leading-[1.05] tracking-[-1.1px] text-[var(--ink)]">
              Đăng nhập
            </h1>
            <p className="mt-[9px] text-[13px] leading-[1.6] text-[var(--ink3)]">
              Dùng email nội bộ và mật khẩu đã được cấp. Hệ thống sẽ chuyển về trang đang yêu cầu sau khi xác thực.
            </p>

            <div className="mt-[20px]">
              <LoginForm returnTo={returnTo} initialMessage={initialMessage} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-[10px]">
            {SECURITY_NOTES.map(([label, value, helper]) => (
              <div
                key={label}
                className="min-w-0 rounded-[12px] border border-[var(--line)] bg-[var(--paper)] px-[14px] py-[12px]"
              >
                <div className="text-[10px] font-semibold uppercase leading-none tracking-[1px] text-[var(--ink3)]">
                  {label}
                </div>
                <div className="ofly-num mt-[7px] text-[14px] font-bold leading-[1.2] text-[var(--ink)]">{value}</div>
                <div className="mt-[6px] text-[11px] leading-[1.45] text-[var(--ink3)]">{helper}</div>
              </div>
            ))}
          </div>

          {/* --ink3 thay --ink4: dòng ghi chú này nằm trên nền --canvas, --ink4 chỉ đạt ~2.4:1 */}
          <div className="flex items-start gap-[7px] px-[2px] text-[11.5px] leading-[1.5] text-[var(--ink3)]">
            <ShieldCheck size={14} strokeWidth={1.5} className="mt-[1px] shrink-0" aria-hidden="true" />
            Chỉ tài khoản nội bộ được cấp quyền mới truy cập được khu vực này.
          </div>
        </div>
      </main>
    </div>
  );
}
