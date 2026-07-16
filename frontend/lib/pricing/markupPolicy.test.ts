import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MarkupConfigurationError,
  requireActiveMarkupRules,
  requirePositiveWebMargin,
} from "./markupPolicy";

describe("markup policy", () => {
  it("fails closed when active rules are empty", () => {
    assert.throws(() => requireActiveMarkupRules([]), MarkupConfigurationError);
  });

  it("fails closed when no rule adds a web margin", () => {
    assert.throws(() => requirePositiveWebMargin(0, 0), MarkupConfigurationError);
    assert.doesNotThrow(() => requirePositiveWebMargin(100_000, 0));
  });
});
