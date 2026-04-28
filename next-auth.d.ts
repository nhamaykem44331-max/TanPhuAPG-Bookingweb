import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    fullName: string;
    role: Role;
    active: boolean;
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      email: string;
      fullName: string;
      role: Role;
      active: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    fullName?: string;
    active?: boolean;
  }
}
