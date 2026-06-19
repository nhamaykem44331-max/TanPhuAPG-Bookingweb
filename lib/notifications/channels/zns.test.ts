import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizePhone } from "@/lib/notifications/channels/zns";

describe("normalizePhone", () => {
  it("đổi số 0 đầu sang mã quốc gia 84", () => {
    assert.equal(normalizePhone("0901234567"), "84901234567");
  });

  it("giữ nguyên số đã có 84", () => {
    assert.equal(normalizePhone("84901234567"), "84901234567");
  });

  it("loại bỏ ký tự không phải số (+, khoảng trắng, gạch)", () => {
    assert.equal(normalizePhone("+84 90 123 45 67"), "84901234567");
    assert.equal(normalizePhone("090-123-4567"), "84901234567");
  });
});
