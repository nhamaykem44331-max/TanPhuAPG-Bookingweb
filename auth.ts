import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import authConfig from "./auth.config";
import { loginInputSchema, normalizeLoginEmail } from "@/lib/auth/login";
import { prisma } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Tài khoản",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mật khẩu", type: "password" },
      },
      async authorize(credentials) {
        const parsedCredentials = loginInputSchema.safeParse({
          email: credentials?.email,
          password: credentials?.password,
        });

        if (!parsedCredentials.success) {
          return null;
        }

        const email = normalizeLoginEmail(parsedCredentials.data.email);
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            active: true,
            passwordHash: true,
          },
        });

        if (!user) {
          return null;
        }

        const passwordMatches = await bcrypt.compare(parsedCredentials.data.password, user.passwordHash);

        if (!passwordMatches || !user.active) {
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          active: user.active,
        };
      },
    }),
  ],
});
