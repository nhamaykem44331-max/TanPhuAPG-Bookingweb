import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { vnDateKey, vnHour } from "@/lib/bookings/opsAggregation";

describe("vn timezone helpers", () => {
  it("vnHour cộng offset +7 trong cùng ngày", () => {
    assert.equal(vnHour(new Date("2026-06-18T03:00:00Z")), 10);
  });

  it("vnHour cuộn sang ngày hôm sau khi qua mốc 17h UTC", () => {
    // 18:00Z = 01:00 hôm sau theo giờ VN.
    assert.equal(vnHour(new Date("2026-06-18T18:00:00Z")), 1);
  });

  it("vnDateKey cuộn ngày theo giờ VN", () => {
    assert.equal(vnDateKey(new Date("2026-06-18T18:00:00Z")), "2026-06-19");
    assert.equal(vnDateKey(new Date("2026-06-18T16:59:00Z")), "2026-06-18");
  });
});
