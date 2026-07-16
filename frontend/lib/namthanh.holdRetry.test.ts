import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isRetryableHoldError, NamThanhApiError } from "./namthanh";

describe("hold retry safety", () => {
  it("never retries when backend marks the upstream outcome unsafe", () => {
    const error = new NamThanhApiError("Upstream timeout", 504, { safeToRetry: false });
    assert.equal(isRetryableHoldError(error), false);
  });

  it("still retries a transient error explicitly safe for replay", () => {
    const error = new NamThanhApiError("Temporarily unavailable", 503, { safeToRetry: true });
    assert.equal(isRetryableHoldError(error), true);
  });
});
