// Quick debug helper — xem webhook gần nhất từ SePay
require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const txns = await p.bankTransaction.findMany({
    where: { provider: 'SEPAY' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      paymentIntent: { select: { providerOrderCode: true, bookingId: true, status: true } },
    },
  });

  if (txns.length === 0) {
    console.log('❌ Chưa có webhook SePay nào trong DB.');
    console.log('   → Webhook URL trên SePay sai, hoặc cloudflared chưa expose, hoặc IP/auth fail.');
    return;
  }

  for (const t of txns) {
    console.log('---');
    console.log(`[${t.createdAt.toISOString()}] ${t.status}`);
    console.log(`  amount: ${t.amount.toLocaleString('vi-VN')}đ`);
    console.log(`  description: ${t.description}`);
    console.log(`  manualReviewReason: ${t.manualReviewReason || '(none)'}`);
    console.log(`  paymentIntent: ${t.paymentIntent ? `${t.paymentIntent.providerOrderCode} (${t.paymentIntent.status})` : '(unmapped)'}`);
  }
}

main().catch(console.error).finally(() => p.$disconnect());
