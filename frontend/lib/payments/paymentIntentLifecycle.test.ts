import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PaymentIntentStatus } from "@prisma/client";

import {
  canCancelPaymentIntent,
  getEffectivePaymentIntentStatus,
  isActivePaymentIntent,
  isPaymentIntentExpired,
  isReusablePaymentIntent,
  paymentIntentRemainingAmount,
  sortPaymentIntentsNewestFirst,
} from "./paymentIntentLifecycle";

function intent(overrides: Partial<{
  amount: number;
  checkoutUrl: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  status: PaymentIntentStatus;
}> = {}) {
  return {
    amount: 1_500_000,
    checkoutUrl: "https://pay.payos.vn/checkout",
    createdAt: new Date("2026-04-24T08:00:00+07:00"),
    expiresAt: new Date("2026-04-24T12:00:00+07:00"),
    status: PaymentIntentStatus.PENDING,
    ...overrides,
  };
}

describe("paymentIntentLifecycle", () => {
  it("đánh dấu intent hết hạn khi expiresAt đã qua", () => {
    assert.equal(
      isPaymentIntentExpired(intent(), new Date("2026-04-24T12:05:00+07:00")),
      true,
    );
  });

  it("giữ trạng thái hiện tại khi intent chưa hết hạn", () => {
    assert.equal(
      getEffectivePaymentIntentStatus(intent(), new Date("2026-04-24T11:00:00+07:00")),
      PaymentIntentStatus.PENDING,
    );
  });

  it("intent pending còn hạn được xem là active", () => {
    assert.equal(
      isActivePaymentIntent(intent(), new Date("2026-04-24T11:00:00+07:00")),
      true,
    );
  });

  it("intent chỉ reusable khi amount trùng balance hiện tại", () => {
    assert.equal(
      isReusablePaymentIntent(intent(), 1_500_000, new Date("2026-04-24T11:00:00+07:00")),
      true,
    );
    assert.equal(
      isReusablePaymentIntent(intent(), 500_000, new Date("2026-04-24T11:00:00+07:00")),
      false,
    );
  });

  it("không cho hủy intent đã terminal", () => {
    assert.equal(
      canCancelPaymentIntent(intent({ status: PaymentIntentStatus.CANCELLED }), new Date("2026-04-24T11:00:00+07:00")),
      false,
    );
  });

  it("sắp xếp intents mới nhất lên đầu", () => {
    const items = sortPaymentIntentsNewestFirst([
      intent({ createdAt: new Date("2026-04-24T08:00:00+07:00") }),
      intent({ createdAt: new Date("2026-04-24T10:00:00+07:00") }),
    ]);

    assert.equal(items[0].createdAt.toISOString(), "2026-04-24T03:00:00.000Z");
  });
  it("keeps the original target while partial payments reduce the remaining amount", () => {
    assert.equal(
      paymentIntentRemainingAmount(1_000_000, [
        { amount: 400_000, status: "PARTIAL" },
        { amount: 600_000, status: "PAID" },
      ]),
      0,
    );
  });
});
