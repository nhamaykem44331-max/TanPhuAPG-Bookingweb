import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyTicketingSla, DUE_SOON_THRESHOLD_MINUTES } from "@/lib/bookings/ticketingQueue";

const NOW = Date.UTC(2026, 5, 18, 10, 0, 0);

function atMinutes(offset: number): Date {
  return new Date(NOW + offset * 60_000);
}

describe("classifyTicketingSla", () => {
  it("không có SLA khi slaDueAt null", () => {
    const result = classifyTicketingSla(null, NOW);
    assert.equal(result.state, "NO_SLA");
    assert.equal(result.minutes, null);
  });

  it("quá hạn khi slaDueAt đã ở quá khứ", () => {
    const result = classifyTicketingSla(atMinutes(-3), NOW);
    assert.equal(result.state, "OVERDUE");
    assert.equal(result.minutes, -3);
  });

  it("sắp tới hạn khi còn đúng ngưỡng cảnh báo", () => {
    const result = classifyTicketingSla(atMinutes(DUE_SOON_THRESHOLD_MINUTES), NOW);
    assert.equal(result.state, "DUE_SOON");
    assert.equal(result.minutes, DUE_SOON_THRESHOLD_MINUTES);
  });

  it("sắp tới hạn khi đúng thời điểm hiện tại", () => {
    const result = classifyTicketingSla(atMinutes(0), NOW);
    assert.equal(result.state, "DUE_SOON");
    assert.equal(result.minutes, 0);
  });

  it("đúng tiến độ khi vượt ngưỡng cảnh báo", () => {
    const result = classifyTicketingSla(atMinutes(DUE_SOON_THRESHOLD_MINUTES + 1), NOW);
    assert.equal(result.state, "ON_TRACK");
    assert.equal(result.minutes, DUE_SOON_THRESHOLD_MINUTES + 1);
  });

  it("đúng tiến độ khi còn nhiều thời gian", () => {
    const result = classifyTicketingSla(atMinutes(45), NOW);
    assert.equal(result.state, "ON_TRACK");
    assert.equal(result.minutes, 45);
  });
});
