import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { bookingListWhereForRole, canRoleMutateBookingAction } from "./ownership";

describe("ownership helpers", () => {
  it("SUPER_ADMIN xem danh sách booking không bị thêm owner filter", () => {
    const baseWhere = { status: "HELD" as const };
    assert.deepEqual(bookingListWhereForRole({ userId: "u1", role: "SUPER_ADMIN" }, baseWhere), baseWhere);
  });

  it("NHAN_VIEN_BAN chỉ xem booking do chính mình tạo", () => {
    assert.deepEqual(bookingListWhereForRole({ userId: "u1", role: "NHAN_VIEN_BAN" }, { status: "HELD" }), {
      AND: [{ status: "HELD" }, { createdById: "u1" }],
    });
  });

  it("KE_TOAN không được issue hoặc cancel booking", () => {
    assert.equal(canRoleMutateBookingAction("KE_TOAN", "issue"), false);
    assert.equal(canRoleMutateBookingAction("KE_TOAN", "cancel"), false);
  });

  it("KE_TOAN được ghi nhận payment thủ công", () => {
    assert.equal(canRoleMutateBookingAction("KE_TOAN", "addPayment"), true);
  });
});
