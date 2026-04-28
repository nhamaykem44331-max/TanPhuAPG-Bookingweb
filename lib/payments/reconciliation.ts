export type PaymentMatchDecision = "PAID" | "PARTIAL" | "MANUAL_REVIEW";

export interface PaymentMatchInput {
  expectedAmount: number;
  transferredAmount: number;
}

export interface PaymentMatchResult {
  decision: PaymentMatchDecision;
  reason: string | null;
}

export function classifyPaymentAmount(input: PaymentMatchInput): PaymentMatchResult {
  if (input.transferredAmount === input.expectedAmount) {
    return { decision: "PAID", reason: null };
  }

  if (input.transferredAmount < input.expectedAmount) {
    return { decision: "PARTIAL", reason: "UNDERPAID" };
  }

  return { decision: "MANUAL_REVIEW", reason: "OVERPAID" };
}

export function buildPayOSDedupeKey(input: {
  reference?: string | null;
  paymentLinkId?: string | null;
  orderCode?: number | string | null;
  amount: number;
}): string {
  const uniquePart = input.reference?.trim()
    || input.paymentLinkId?.trim()
    || input.orderCode?.toString().trim()
    || "UNKNOWN";

  return `PAYOS:${uniquePart}:${input.amount}`;
}

export function parsePayOSTransactionDateTime(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}+07:00`;
  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildPayOSDescription(orderCode: string): string {
  return `APG${orderCode}`;
}
