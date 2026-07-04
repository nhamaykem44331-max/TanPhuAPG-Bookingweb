import { Role } from "@prisma/client";
import { z } from "zod";

const roleValues = Object.values(Role) as [Role, ...Role[]];

export const adminUserListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(100, "Từ khóa tìm kiếm không được vượt quá 100 ký tự.")
    .optional()
    .transform((value) => value || undefined),
  role: z.enum(roleValues).optional(),
  active: z.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const adminUserCreateSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ.").toLowerCase(),
  fullName: z.string().trim().min(3, "Họ tên tối thiểu 3 ký tự.").max(120),
  role: z.enum(roleValues),
  active: z.boolean().default(true),
  tempPassword: z
    .string()
    .min(8, "Mật khẩu tạm tối thiểu 8 ký tự.")
    .max(80)
    .optional()
    .transform((value) => value || undefined),
});

export const adminUserPatchSchema = z.object({
  fullName: z.string().trim().min(3, "Họ tên tối thiểu 3 ký tự.").max(120).optional(),
  role: z.enum(roleValues).optional(),
  active: z.boolean().optional(),
});

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;
export type AdminUserCreateInput = z.infer<typeof adminUserCreateSchema>;
export type AdminUserPatchInput = z.infer<typeof adminUserPatchSchema>;
