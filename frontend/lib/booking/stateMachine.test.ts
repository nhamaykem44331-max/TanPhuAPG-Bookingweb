import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertTransition, canTransition } from "@/lib/booking/stateMachine";

describe("stateMachine", () => {
  it("cho phép luồng thanh toán → xuất vé hợp lệ", () => {
    assert.equal(canTransition("QUOTED", "HELD"), true);
    assert.equal(canTransition("HELD", "PENDING_PAYMENT"), true);
    assert.equal(canTransition("HELD", "PAID"), true);
    assert.equal(canTransition("PENDING_PAYMENT", "PAID"), true);
    assert.equal(canTransition("PAID", "TICKETING"), true);
    assert.equal(canTransition("PAID", "TICKETED"), true);
    assert.equal(canTransition("TICKETING", "TICKETED"), true);
  });

  it("cho phép luồng không xuất được → hoàn tiền", () => {
    assert.equal(canTransition("PAID", "CANNOT_ISSUE"), true);
    assert.equal(canTransition("CANNOT_ISSUE", "REFUND_REQUIRED"), true);
    assert.equal(canTransition("CANNOT_ISSUE", "TICKETING"), true);
    assert.equal(canTransition("REFUND_REQUIRED", "REFUNDED"), true);
    assert.equal(canTransition("PAYMENT_FAILED", "HELD"), true);
  });

  it("chặn các bước nhảy cóc không hợp lệ", () => {
    assert.equal(canTransition("HELD", "TICKETED"), false, "phải thanh toán trước khi xuất vé");
    assert.equal(canTransition("QUOTED", "PAID"), false);
    assert.equal(canTransition("PAID", "EXPIRED"), false, "đã trả tiền thì không tự hết hạn");
    assert.equal(canTransition("PENDING_PAYMENT", "TICKETED"), false);
  });

  it("các trạng thái kết thúc không có bước tiếp", () => {
    for (const terminal of ["TICKETED", "REFUNDED", "EXPIRED", "CANCELLED"] as const) {
      assert.equal(canTransition(terminal, "HELD"), false, `${terminal} là trạng thái kết thúc`);
    }
  });

  it("assertTransition trả về lý do khi bước không hợp lệ", () => {
    const ok = assertTransition("PAID", "TICKETED");
    assert.equal(ok.ok, true);

    const bad = assertTransition("TICKETED", "CANCELLED");
    assert.equal(bad.ok, false);
    if (!bad.ok) {
      assert.match(bad.reason, /không thể chuyển/i);
    }
  });
});
