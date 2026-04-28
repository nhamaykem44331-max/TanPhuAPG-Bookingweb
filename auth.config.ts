import type { Role } from "@prisma/client";
import type { NextAuthConfig } from "next-auth";

const isProduction = process.env.NODE_ENV === "production";
const sessionCookieName = isProduction ? "__Host-admin-session" : "admin-session";

const authConfig = {
  providers: [],
  trustHost: true,
  pages: {
    signIn: "/admin/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
  },
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  cookies: {
    sessionToken: {
      name: sessionCookieName,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
      },
    },
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: Role }).role;
        token.fullName = (user as { fullName?: string }).fullName;
        token.active = (user as { active?: boolean }).active;
      }

      return token;
    },
    session({ session, token }) {
      if (!session.user) {
        return session;
      }

      session.user.id = typeof token.sub === "string" ? token.sub : "";
      session.user.email = typeof token.email === "string" ? token.email : "";
      session.user.role = token.role as Role;
      session.user.fullName = typeof token.fullName === "string" ? token.fullName : "";
      session.user.active = token.active !== false;

      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
