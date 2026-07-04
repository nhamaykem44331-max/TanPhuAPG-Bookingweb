import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildAuditDiff } from "./diff";

describe("buildAuditDiff", () => {
  it("trả payload create khi before=null", () => {
    assert.deepEqual(buildAuditDiff(null, { a: 1, b: 2 }), {
      before: null,
      after: { a: 1, b: 2 },
      changedFields: [],
    });
  });

  it("trả diff một field khi giá trị thay đổi", () => {
    assert.deepEqual(buildAuditDiff({ a: 1 }, { a: 2 }), {
      before: { a: 1 },
      after: { a: 2 },
      changedFields: ["a"],
    });
  });

  it("chỉ giữ field thật sự đổi trong before và after", () => {
    assert.deepEqual(buildAuditDiff({ a: 1, b: 2 }, { a: 1, b: 3 }), {
      before: { b: 2 },
      after: { b: 3 },
      changedFields: ["b"],
    });
  });

  it("trả diff rỗng khi không có field đổi", () => {
    assert.deepEqual(buildAuditDiff({ a: 1 }, { a: 1 }), {
      before: {},
      after: {},
      changedFields: [],
    });
  });

  it("chỉ track fieldsToTrack được chỉ định", () => {
    assert.deepEqual(buildAuditDiff({ a: 1, b: 2 }, { a: 1, b: 3 }, ["a"]), {
      before: {},
      after: {},
      changedFields: [],
    });
  });
});
