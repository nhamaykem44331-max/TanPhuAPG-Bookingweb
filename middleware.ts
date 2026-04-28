import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import authConfig from "./auth.config";
import { MARKUP_RULE_MANAGER_ROLES } from "@/lib/auth/constants";

const { auth } = NextAuth(authConfig);

function buildReturnTo(pathname: string, search: string): string {
  return `${pathname}${search}`;
}

export default auth((request) => {
  const pathname = request.nextUrl.pathname;
  const search = request.nextUrl.search;
  const isAdminApiRoute = pathname.startsWith("/api/admin");
  const isPublicAdminLoginApi = pathname === "/api/admin/login";
  const isLoginPage = pathname === "/admin/login";
  const isMarkupRuleRoute = pathname.startsWith("/admin/markup-rules") || pathname.startsWith("/api/admin/markup-rules");
  const session = request.auth;

  if (!session?.user) {
    if (isLoginPage || isPublicAdminLoginApi) {
      return NextResponse.next();
    }

    if (isAdminApiRoute) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const loginUrl = new URL("/admin/login", request.nextUrl);
    loginUrl.searchParams.set("returnTo", buildReturnTo(pathname, search));
    return NextResponse.redirect(loginUrl);
  }

  if (session.user.active === false) {
    if (isAdminApiRoute) {
      return NextResponse.json({ error: "Tài khoản đã bị khóa." }, { status: 403 });
    }

    const loginUrl = new URL("/admin/login", request.nextUrl);
    loginUrl.searchParams.set("error", "inactive");
    return NextResponse.redirect(loginUrl);
  }

  const role = session.user.role;

  if (isMarkupRuleRoute && (!role || !MARKUP_RULE_MANAGER_ROLES.includes(role))) {
    if (pathname.startsWith("/api/admin/markup-rules")) {
      return NextResponse.json({ error: "Bạn không có quyền truy cập." }, { status: 403 });
    }

    return new NextResponse("403 Forbidden", { status: 403 });
  }

  if (isLoginPage) {
    return NextResponse.redirect(new URL("/admin", request.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
