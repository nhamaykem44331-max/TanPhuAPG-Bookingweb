import { PaymentIntentStatus, type PaymentIntent } from "@prisma/client";

export const ACTIVE_PAYMENT_INTENT_STATUSES = [
  PaymentIntentStatus.PENDING,
  PaymentIntentStatus.PARTIAL,
] as const;

export type PaymentIntentLike = Pick<
  PaymentIntent,
  "amount" | "checkoutUrl" | "createdAt" | "expiresAt" | "status"
>;

export function isPaymentIntentExpired(intent: PaymentIntentLike, now = new Date()): boolean {
  if (!ACTIVE_PAYMENT_INTENT_STATUSES.includes(intent.status as (typeof ACTIVE_PAYMENT_INTENT_STATUSES)[number])) {
    return false;
  }

  return !!intent.expiresAt && intent.expiresAt.getTime() <= now.getTime();
}

export function getEffectivePaymentIntentStatus(
  intent: PaymentIntentLike,
  now = new Date(),
): PaymentIntentStatus {
  return isPaymentIntentExpired(intent, now) ? PaymentIntentStatus.EXPIRED : intent.status;
}

export function isActivePaymentIntent(intent: PaymentIntentLike, now = new Date()): boolean {
  return ACTIVE_PAYMENT_INTENT_STATUSES.includes(getEffectivePaymentIntentStatus(intent, now) as (typeof ACTIVE_PAYMENT_INTENT_STATUSES)[number]);
}

export function isReusablePaymentIntent(
  intent: PaymentIntentLike,
  balance: number,
  now = new Date(),
): boolean {
  return isActivePaymentIntent(intent, now) && !!intent.checkoutUrl && intent.amount === balance;
}

export function canCancelPaymentIntent(intent: PaymentIntentLike, now = new Date()): boolean {
  const effectiveStatus = getEffectivePaymentIntentStatus(intent, now);
  return effectiveStatus === PaymentIntentStatus.PENDING || effectiveStatus === PaymentIntentStatus.PARTIAL;
}

export function sortPaymentIntentsNewestFirst<T extends Pick<PaymentIntent, "createdAt">>(intents: T[]): T[] {
  return [...intents].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

export function paymentIntentRemainingAmount(
  targetAmount: number,
  payments: Array<{ amount: number; status: string }>,
): number {
  const paid = payments.reduce((sum, payment) => {
    return payment.status === "PAID" || payment.status === "PARTIAL"
      ? sum + payment.amount
      : sum;
  }, 0);

  return Math.max(targetAmount - paid, 0);
}
