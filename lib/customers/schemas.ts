import { z } from "zod";

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải theo định dạng YYYY-MM-DD.");

const nullableText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(max).nullable().optional(),
  );

const optionalEmailSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().email("Email không hợp lệ.").nullable().optional(),
);

const optionalPhoneSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z
    .string()
    .trim()
    .regex(/^\+?\d{9,15}$/, "Số điện thoại không hợp lệ.")
    .nullable()
    .optional(),
);

const nullableIsoDateSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  isoDateSchema.nullable().optional(),
);

export const adminCustomerListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(100, "Từ khóa tìm kiếm không được vượt quá 100 ký tự.")
    .optional()
    .transform((value) => value || undefined),
  blacklisted: z.boolean().optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const adminCustomerInputSchema = z.object({
  fullName: z.string().trim().min(1, "Thiếu họ tên khách hàng.").max(120, "Họ tên không được vượt quá 120 ký tự."),
  phone: optionalPhoneSchema,
  email: optionalEmailSchema,
  idNumber: nullableText(30),
  passport: nullableText(30),
  dob: nullableIsoDateSchema,
  tags: z.unknown().nullable().optional(),
  blacklisted: z.boolean().default(false),
});

export const adminCustomerPatchSchema = adminCustomerInputSchema.partial();

export const customerMergeInputSchema = z.object({
  mergedCustomerIds: z.array(z.string().cuid()).min(1).max(10),
});

export type AdminCustomerListQuery = z.infer<typeof adminCustomerListQuerySchema>;
export type AdminCustomerInput = z.infer<typeof adminCustomerInputSchema>;
export type AdminCustomerPatchInput = z.infer<typeof adminCustomerPatchSchema>;
export type CustomerMergeInput = z.infer<typeof customerMergeInputSchema>;
