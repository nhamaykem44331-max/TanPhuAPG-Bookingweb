#!/usr/bin/env node
/**
 * Chạy lệnh Prisma có CHỐT CHẶN chống lặp lại sự cố xoá sạch DB production (14/07/2026).
 *
 * Nạp .env.local rồi soi DATABASE_URL:
 *  - Trỏ DB PRODUCTION + lệnh thuộc nhóm PHÁ HỦY  → CHẶN (trừ khi đặt ALLOW_PROD_DB=1).
 *  - Còn lại → chạy bình thường.
 *
 * Nhóm phá hủy = migrate dev | migrate reset | db push | db execute:
 * `migrate dev` và `db push` có thể tự đề nghị reset khi migration bị drift — đúng cái
 * đã xoá sạch đơn/khách/markup rules hôm 14/07. Đưa schema lên prod chỉ dùng `migrate deploy`.
 *
 * Dùng: node scripts/db-guarded.js migrate dev
 *       node scripts/db-guarded.js db push
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });

// Ref project Supabase của PRODUCTION. Thêm ref mới vào đây nếu đổi hạ tầng.
const PROD_DB_REFS = ["scwpkgbuibexhefjzngg"];

const DESTRUCTIVE = [
  ["migrate", "dev"],
  ["migrate", "reset"],
  ["db", "push"],
  ["db", "execute"],
];

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Thiếu lệnh prisma. Ví dụ: node scripts/db-guarded.js migrate dev");
  process.exit(1);
}

const url = process.env.DATABASE_URL || "";
const matchedRef = PROD_DB_REFS.find((ref) => url.includes(ref));
const isDestructive = DESTRUCTIVE.some(([a, b]) => args[0] === a && args[1] === b);

if (matchedRef && isDestructive && process.env.ALLOW_PROD_DB !== "1") {
  const cmd = `prisma ${args.join(" ")}`;
  console.error(
    [
      "",
      "\x1b[41m\x1b[97m  ⛔ ĐÃ CHẶN: lệnh phá hủy đang trỏ vào DB PRODUCTION  \x1b[0m",
      "",
      `  Lệnh   : ${cmd}`,
      `  DB     : Supabase ${matchedRef} (PRODUCTION — đơn thật, tiền thật)`,
      "",
      "  Lệnh này có thể đòi RESET và xoá sạch dữ liệu — đúng như sự cố 14/07/2026",
      "  (mất toàn bộ markup rules, tài khoản admin, đơn & khách cũ).",
      "",
      "  Cách làm đúng:",
      "   • Sửa schema  → chạy trên DB DEV (.env.local đang trỏ dev là chuẩn)",
      "   • Lên prod    → chỉ dùng: npm run db:migrate:deploy (không bao giờ reset)",
      "",
      "  Nếu THỰC SỰ cố ý (hiếm, cân nhắc kỹ): ALLOW_PROD_DB=1 " + cmd,
      "",
    ].join("\n"),
  );
  process.exit(1);
}

if (matchedRef) {
  console.warn(`\x1b[33m⚠  Đang thao tác trên DB PRODUCTION (${matchedRef}) — lệnh: prisma ${args.join(" ")}\x1b[0m`);
}

const result = spawnSync("npx", ["prisma", ...args], { stdio: "inherit", shell: true });
process.exit(result.status ?? 1);
