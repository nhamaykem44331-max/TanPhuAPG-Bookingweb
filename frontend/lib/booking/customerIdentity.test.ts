import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { customerIdentityWhere } from "./customerIdentity";

describe("customer identity", () => {
  it("matches the complete normalized contact pair instead of email OR phone", () => {
    assert.deepEqual(customerIdentityWhere({ email: " A@Example.COM ", phone: "+84 912 345 678" }), {
      email: "a@example.com",
      phone: "0912345678",
    });
  });
});
