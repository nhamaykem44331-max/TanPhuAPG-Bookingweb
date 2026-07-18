import { test } from "node:test";
import assert from "node:assert/strict";

import { isValidAnonId, isAllowedWebOrigin, ipRateLimited } from "./webGuards";

test("isValidAnonId: nhận dạng đúng anonId widget sinh ra", () => {
  assert.equal(isValidAnonId("web_" + "a1b2c3d4e5f6a7b8"), true);
  assert.equal(isValidAnonId("web_" + "0".repeat(32)), true);
});

test("isValidAnonId: chặn chuỗi tuỳ ý / sai prefix / quá ngắn / ký tự lạ", () => {
  assert.equal(isValidAnonId(""), false);
  assert.equal(isValidAnonId("abc"), false);
  assert.equal(isValidAnonId("zalo_123456789012345678"), false);
  assert.equal(isValidAnonId("web_ngắn"), false);
  assert.equal(isValidAnonId("web_" + "a".repeat(8)), false); // <16
  assert.equal(isValidAnonId("web_" + "a".repeat(70)), false); // >64
  assert.equal(isValidAnonId("web_ABCDEF1234567890"), false); // hoa không hợp lệ
  assert.equal(isValidAnonId("web_abc def456789012345"), false);
});

test("isAllowedWebOrigin: cùng host với request hoặc NEXT_PUBLIC_SITE_URL → cho qua", () => {
  assert.equal(
    isAllowedWebOrigin("https://tanphuapg.com", null, "tanphuapg.com", "https://tanphuapg.com"),
    true,
  );
  // Preview Vercel: origin khớp host đang phục vụ dù khác SITE_URL.
  assert.equal(
    isAllowedWebOrigin("https://web-abc.vercel.app", null, "web-abc.vercel.app", "https://tanphuapg.com"),
    true,
  );
  // Localhost dev: host mang port, origin mang port — so hostname là qua.
  assert.equal(
    isAllowedWebOrigin("http://localhost:3000", null, "localhost:3000", undefined),
    true,
  );
  // Không có Origin nhưng có Referer cùng host.
  assert.equal(
    isAllowedWebOrigin(null, "https://tanphuapg.com/dat-ve?go=1", "tanphuapg.com", undefined),
    true,
  );
});

test("isAllowedWebOrigin: khác host / thiếu cả Origin lẫn Referer / origin hỏng → chặn", () => {
  assert.equal(
    isAllowedWebOrigin("https://evil.example", null, "tanphuapg.com", "https://tanphuapg.com"),
    false,
  );
  assert.equal(isAllowedWebOrigin(null, null, "tanphuapg.com", "https://tanphuapg.com"), false);
  assert.equal(isAllowedWebOrigin("not-a-url", null, "tanphuapg.com", undefined), false);
  // Subdomain lạ không tự động được cho qua.
  assert.equal(
    isAllowedWebOrigin("https://fake.tanphuapg.com.evil.example", null, "tanphuapg.com", "https://tanphuapg.com"),
    false,
  );
});

test("ipRateLimited: dưới trần cho qua, quá trần chặn, hết cửa sổ reset", () => {
  const ip = "203.0.113.9";
  const t0 = 1_000_000;
  for (let i = 0; i < 60; i++) {
    assert.equal(ipRateLimited(ip, t0 + i), false, `tin ${i + 1} phải được qua`);
  }
  assert.equal(ipRateLimited(ip, t0 + 100), true, "tin 61 trong cửa sổ phải bị chặn");
  // Hết cửa sổ 10 phút → đếm lại từ đầu.
  assert.equal(ipRateLimited(ip, t0 + 10 * 60_000 + 1), false);
});
