/**
 * Giả lập webhook SePay đẩy về local server.
 *
 * Sử dụng:
 *   node scripts/sepay-test-webhook.js                       # auto pick PENDING intent
 *   node scripts/sepay-test-webhook.js APG1778083257524 2286840
 */
require("dotenv").config({ path: ".env.local" });
const { PrismaClient } = require("@prisma/client");

const URL = process.env.SEPAY_TEST_URL || "http://localhost:3000/api/webhooks/sepay";
const API_KEY = process.env.SEPAY_WEBHOOK_API_KEY || "tanphuapg-sepay-2026";

async function main() {
  let content = process.argv[2];
  let amount = process.argv[3] ? Number(process.argv[3]) : null;

  if (!content || !amount) {
    const p = new PrismaClient();
    const intent = await p.paymentIntent.findFirst({
      where: { provider: "SEPAY", status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    await p.$disconnect();

    if (!intent) {
      console.error("❌ Không có PaymentIntent SEPAY PENDING. Vào /booking/payment/<id> tạo QR trước.");
      process.exit(1);
    }
    content = intent.transferContent;
    amount = intent.amount;
  }

  const payload = {
    id: Math.floor(Math.random() * 100000000),
    gateway: "BIDV",
    transactionDate: new Date().toISOString().slice(0, 19).replace("T", " "),
    accountNumber: process.env.SEPAY_BANK_ACCOUNT || "8869414319",
    subAccount: null,
    transferType: "in",
    transferAmount: amount,
    accumulated: amount + 1000000,
    code: null,
    content: `Khach hang chuyen tien ${content} cho ve may bay`,
    referenceCode: `FT${Date.now()}`,
    description: "Test webhook giả lập",
  };

  console.log("📤 POST", URL);
  console.log("   content:", payload.content);
  console.log("   amount: ", amount.toLocaleString("vi-VN"), "₫");
  console.log("   id:     ", payload.id);

  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Apikey ${API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  console.log("\n📥 Response", res.status);
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text);
  }
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
