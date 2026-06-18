import { BookingStatus } from "@prisma/client";
import { z } from "zod";

const tripTypeSchema = z.enum(["ONEWAY", "ROUNDTRIP"]);

const airportCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Mã sân bay phải gồm 3 ký tự.");

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải theo định dạng YYYY-MM-DD.");

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?\d{9,15}$/, "Số điện thoại không hợp lệ.");

const serviceSelectionSchema = z.object({
  route: z.string().trim().min(1).optional(),
  segmentId: z.coerce.number().int().optional(),
  airline: z.string().trim().min(1).optional(),
  serviceType: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1),
  key: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  unit: z.string().trim().min(1).optional(),
  price: z.coerce.number().nonnegative().optional(),
});

export const holdPassengerSchema = z.object({
  type: z.enum(["ADT", "CHD", "INF"]),
  firstName: z.string().trim().min(1, "Thiếu tên hành khách."),
  lastName: z.string().trim().min(1, "Thiếu họ hành khách."),
  fullName: z.string().trim().min(1).optional(),
  dob: isoDateSchema.optional(),
  gender: z.enum(["M", "F"]).optional(),
  loyaltyAirline: z.string().trim().max(10).optional(),
  loyaltyNumber: z.string().trim().max(50).optional(),
  passport: z
    .object({
      number: z.string().trim().max(30).optional(),
      nationality: z.string().trim().max(10).optional(),
      issuingCountry: z.string().trim().max(10).optional(),
      issueDate: isoDateSchema.optional(),
      expiryDate: isoDateSchema.optional(),
    })
    .optional(),
  listLuggage: z.array(serviceSelectionSchema).optional(),
  ancillaryServices: z.array(serviceSelectionSchema).optional(),
});

export const holdContactSchema = z.object({
  fullName: z.string().trim().min(1, "Thiếu tên liên hệ."),
  phone: phoneSchema,
  email: z.string().trim().email("Email không hợp lệ."),
});

export const holdFlightSelectionSchema = z.object({
  id: z.string().trim().min(1, "Thiếu flightId."),
  searchId: z.string().trim().min(1).optional(),
  fareId: z.string().trim().min(1).optional(),
  airlineCode: z.string().trim().toUpperCase().max(10).optional(),
  airline: z.string().trim().max(80).optional(),
  departure: z.object({
    airport: airportCodeSchema,
    time: z.string().trim().min(1),
  }),
  arrival: z.object({
    airport: airportCodeSchema,
    time: z.string().trim().min(1),
  }),
  price: z
    .object({
      amount: z.coerce.number().nonnegative(),
    })
    .optional(),
  fareBreakdown: z
    .object({
      totalAmount: z.coerce.number().nonnegative(),
    })
    .optional(),
  namthanh: z
    .object({
      fareId: z.string().trim().min(1).optional(),
      class: z.string().trim().max(20).optional(),
      cabinClass: z.string().trim().max(40).optional(),
      fareBasis: z.string().trim().max(40).optional(),
    })
    .optional(),
});

export const holdInputSchema = z.object({
  tripType: tripTypeSchema,
  displayedNetPrice: z.coerce.number().positive("Giá hiển thị phải lớn hơn 0."),
  passengers: z.array(holdPassengerSchema).min(1).max(9),
  contact: holdContactSchema,
  outbound: holdFlightSelectionSchema,
  inbound: holdFlightSelectionSchema.optional(),
  cabin: z.string().trim().max(20).optional(),
  search: z
    .object({
      from: airportCodeSchema,
      to: airportCodeSchema,
      date: isoDateSchema,
      returnDate: isoDateSchema.optional(),
    })
    .optional(),
  dryRun: z.boolean().default(false),
  idempotencyKey: z.string().trim().max(120).optional(),
});

export type HoldInput = z.infer<typeof holdInputSchema>;
export type HoldPassengerInput = z.infer<typeof holdPassengerSchema>;

const bookingStatusValues = Object.values(BookingStatus) as [BookingStatus, ...BookingStatus[]];

// Tab "Tất cả đơn" gom nhiều trạng thái thành 1 nhóm (parity tabDefs file thiết kế).
export const ORDER_TAB_KEYS = ["all", "queue", "held", "pending", "ticketed", "refund", "closed"] as const;
export type OrderTabKey = (typeof ORDER_TAB_KEYS)[number];

export const adminBookingListQuerySchema = z.object({
  status: z.enum(bookingStatusValues).optional(),
  tab: z.enum(ORDER_TAB_KEYS).optional(),
  q: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => value || undefined),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  pnr: z.string().trim().max(30).optional(),
  orderCode: z.string().trim().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type AdminBookingListQuery = z.infer<typeof adminBookingListQuerySchema>;

export const ticketingQueueQuerySchema = z.object({
  assignedToId: z.string().trim().min(1).max(40).optional(),
  unassigned: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  overdueOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type TicketingQueueQuery = z.infer<typeof ticketingQueueQuerySchema>;

export const adminBookingPaymentInputSchema = z.object({
  method: z.enum(["CASH", "BANK", "QR", "CARD", "CREDIT"]),
  amount: z.coerce.number().int().positive("Số tiền thanh toán phải lớn hơn 0.").max(10_000_000_000),
  transactionRef: z
    .string()
    .trim()
    .max(100, "Mã giao dịch không được vượt quá 100 ký tự.")
    .optional()
    .transform((value) => value || undefined),
  paidAt: z.string().datetime("Thời gian thanh toán không hợp lệ.").optional(),
  proofUrl: z
    .string()
    .trim()
    .url("URL chứng từ không hợp lệ.")
    .optional()
    .transform((value) => value || undefined),
  notes: z
    .string()
    .trim()
    .max(500, "Ghi chú không được vượt quá 500 ký tự.")
    .optional()
    .transform((value) => value || undefined),
});

export type AdminBookingPaymentInput = z.infer<typeof adminBookingPaymentInputSchema>;

export const issueTicketInputSchema = z.object({
  ticketNumbers: z
    .array(
      z.object({
        passengerName: z.string().trim().min(1, "Thiếu tên hành khách."),
        ticketNumber: z.string().trim().min(1, "Thiếu số vé.").max(30, "Số vé không được vượt quá 30 ký tự."),
      }),
    )
    .max(9)
    .optional(),
  notes: z
    .string()
    .trim()
    .max(500, "Ghi chú không được vượt quá 500 ký tự.")
    .optional()
    .transform((value) => value || undefined),
});

export type IssueTicketInput = z.infer<typeof issueTicketInputSchema>;

export const cancelBookingInputSchema = z
  .object({
    reason: z.enum(["CUSTOMER_REQUEST", "PAYMENT_FAIL", "AIRLINE_CANCEL", "DUPLICATE", "OTHER"]),
    detail: z
      .string()
      .trim()
      .max(1000, "Chi tiết hủy không được vượt quá 1000 ký tự.")
      .optional()
      .transform((value) => value || undefined),
    markRefund: z.boolean().default(false),
    refundAmount: z.coerce.number().int().positive("Số tiền hoàn phải lớn hơn 0.").optional(),
  })
  .refine((value) => value.reason !== "OTHER" || (value.detail && value.detail.length >= 10), {
    message: "reason=OTHER bắt buộc detail tối thiểu 10 ký tự",
    path: ["detail"],
  })
  .refine((value) => !value.markRefund || value.refundAmount !== undefined, {
    message: "markRefund=true bắt buộc refundAmount",
    path: ["refundAmount"],
  });

export type CancelBookingInput = z.infer<typeof cancelBookingInputSchema>;

const optionalNotes = z
  .string()
  .trim()
  .max(500, "Ghi chú không được vượt quá 500 ký tự.")
  .optional()
  .transform((value) => value || undefined);

export const claimBookingInputSchema = z.object({
  notes: optionalNotes,
});

export type ClaimBookingInput = z.infer<typeof claimBookingInputSchema>;

export const cannotIssueInputSchema = z
  .object({
    reason: z.enum(["NO_SEAT", "PRICE_INCREASED", "SCHEDULE_CHANGE", "AIRLINE_REJECT", "DUPLICATE", "OTHER"]),
    detail: z
      .string()
      .trim()
      .max(1000, "Chi tiết không được vượt quá 1000 ký tự.")
      .optional()
      .transform((value) => value || undefined),
  })
  .refine((value) => value.reason !== "OTHER" || (value.detail && value.detail.length >= 10), {
    message: "reason=OTHER bắt buộc detail tối thiểu 10 ký tự",
    path: ["detail"],
  });

export type CannotIssueInput = z.infer<typeof cannotIssueInputSchema>;

export const refundRequestInputSchema = z.object({
  amount: z.coerce.number().int().positive("Số tiền hoàn phải lớn hơn 0.").max(10_000_000_000),
  reason: z.string().trim().min(3, "Lý do hoàn tiền tối thiểu 3 ký tự.").max(500),
});

export type RefundRequestInput = z.infer<typeof refundRequestInputSchema>;

export const refundConfirmInputSchema = z.object({
  refundId: z.string().trim().min(1).optional(),
  method: z.enum(["CASH", "BANK", "QR", "CARD", "CREDIT"]).default("BANK"),
  transactionRef: z
    .string()
    .trim()
    .max(100, "Mã giao dịch không được vượt quá 100 ký tự.")
    .optional()
    .transform((value) => value || undefined),
  refundedAt: z.string().datetime("Thời gian hoàn tiền không hợp lệ.").optional(),
  notes: optionalNotes,
});

export type RefundConfirmInput = z.infer<typeof refundConfirmInputSchema>;

export const handoffInputSchema = z.object({
  notes: optionalNotes,
});

export type HandoffInput = z.infer<typeof handoffInputSchema>;
