import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildBackfillOrderCode, deriveEarliestPnrTimelimit } from "@/lib/bookings/orderManagement";

describe("orderManagement", () => {
  it("buildBackfillOrderCode tạo mã đơn hàng ổn định từ createdAt + id", () => {
    const code = buildBackfillOrderCode({
      id: "cmodu8vsb0001k55kek8hqw49",
      createdAt: new Date("2026-04-25T11:27:00+07:00"),
    });

    assert.equal(code, "APG-260425-EK8HQW49");
  });

  it("deriveEarliestPnrTimelimit lấy TTL sớm nhất từ các PNR con", () => {
    const earliest = deriveEarliestPnrTimelimit(
      [
        { timelimit: new Date("2026-04-27T11:27:00+07:00") },
        { timelimit: new Date("2026-04-25T15:27:00+07:00") },
        { timelimit: new Date("2026-04-26T10:00:00+07:00") },
      ],
      null,
    );

    assert.equal(earliest?.toISOString(), new Date("2026-04-25T15:27:00+07:00").toISOString());
  });

  it("deriveEarliestPnrTimelimit fallback về giá trị cha khi PNR con chưa có TTL", () => {
    const fallback = new Date("2026-04-28T09:00:00+07:00");
    const earliest = deriveEarliestPnrTimelimit([{ timelimit: null }, { timelimit: null }], fallback);

    assert.equal(earliest?.toISOString(), fallback.toISOString());
  });
});
