import type { PaymentStatus } from "@prisma/client";

export interface PaymentSummaryInput {
  amount: number;
  status: PaymentStatus;
}

export interface PaymentSummary {
  totalPaid: number;
  totalDue: number;
  balance: number;
}

export function calculatePaymentSummary(payments: PaymentSummaryInput[], totalDue: number): PaymentSummary {
  const totalPaid = payments.reduce((sum, payment) => {
    if (payment.status === "PAID" || payment.status === "PARTIAL" || payment.status === "REFUNDED") {
      return sum + payment.amount;
    }

    return sum;
  }, 0);

  return {
    totalPaid,
    totalDue,
    balance: totalDue - totalPaid,
  };
}
