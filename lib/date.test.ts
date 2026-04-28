import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatDMY, toISO } from "./date";

describe("date helpers", () => {
  it("toISO đổi dd-mm-yyyy sang yyyy-mm-dd", () => {
    assert.equal(toISO("26-04-2026"), "2026-04-26");
  });

  it("toISO đổi dd/mm/yyyy sang yyyy-mm-dd", () => {
    assert.equal(toISO("26/04/2026"), "2026-04-26");
  });

  it("toISO giữ nguyên yyyy-mm-dd hợp lệ", () => {
    assert.equal(toISO("2026-04-26"), "2026-04-26");
  });

  it("formatDMY đổi yyyy-mm-dd sang dd-mm-yyyy", () => {
    assert.equal(formatDMY("2026-04-26"), "26-04-2026");
  });
});
