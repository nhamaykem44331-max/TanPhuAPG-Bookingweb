import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { after, afterEach, before, describe, it } from "node:test";

import { NotificationJobChannel, NotificationJobStatus, PaymentIntentProvider, PaymentIntentStatus, PaymentStatus, PrismaClient, Role } from "@prisma/client";

import { processDueNotificationJobs } from "./runner";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();

    if (!key || process.env[key]) {
      continue;
    }

    const rawValue = line.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    process.env[key] = value;
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));

const prisma = new PrismaClient();
const createdBookingIds: string[] = [];
const createdCustomerIds: string[] = [];
const createdUserIds: string[] = [];

async function createNotificationFixture(
  options: {
    paymentAmount?: number;
    paymentStatus?: PaymentStatus;
    jobType: string;
    intentAmount?: number;
    provider?: PaymentIntentProvider;
  },
) {
  const unique = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const user = await prisma.user.create({
    data: {
      email: `runner-${unique}@example.com`,
      passwordHash: "hash",
      role: Role.SUPER_ADMIN,
      fullName: `Runner ${unique}`,
    },
  });
  createdUserIds.push(user.id);

  const customer = await prisma.customer.create({
    data: {
      fullName: `Customer ${unique}`,
      email: `customer-${unique}@example.com`,
      phone: `09${String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, "0")}`,
      createdById: user.id,
    },
  });
  createdCustomerIds.push(customer.id);

  const booking = await prisma.booking.create({
    data: {
      orderCode: `APG-TEST-${unique}`.slice(0, 40),
      pnr: `P2${String(Math.floor(Math.random() * 999999)).padStart(6, "0")}`,
      airline: "VJ",
      routeSummary: "SGN-HAN",
      tripType: "ONEWAY",
      netAmount: 1_200_000,
      saleAmount: 1_500_000,
      markupAmount: 300_000,
      serviceFeeAmount: 0,
      profit: 300_000,
      currency: "VND",
      status: "HELD",
      ttlExpiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      customerId: customer.id,
      createdById: user.id,
      channel: "admin",
      source: "test",
    },
  });
  createdBookingIds.push(booking.id);

  if (options.paymentAmount && options.paymentStatus) {
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        method: "BANK",
        amount: options.paymentAmount,
        currency: "VND",
        status: options.paymentStatus,
        paidAt: new Date(),
      },
    });
  }

  const intent = await prisma.paymentIntent.create({
    data: {
      bookingId: booking.id,
      provider: options.provider ?? PaymentIntentProvider.PAYOS,
      providerOrderCode: `${Math.floor(Date.now() / 1000)}${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`,
      amount: options.intentAmount ?? 1_500_000,
      currency: "VND",
      status: PaymentIntentStatus.PENDING,
      description: `TEST-${unique}`.slice(0, 25),
      transferContent: `TEST${unique}`.slice(0, 25),
      checkoutUrl: "https://pay.payos.vn/mock",
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      createdById: user.id,
    },
  });

  const job = await prisma.notificationJob.create({
    data: {
      type: options.jobType,
      channel: NotificationJobChannel.EMAIL,
      bookingId: booking.id,
      paymentIntentId: intent.id,
      scheduledAt: new Date(Date.now() - 60_000),
    },
  });

  return { booking, intent, job };
}

before(() => {
  process.env.NOTIFICATIONS_EMAIL_ENABLED = "false";
  delete process.env.SMTP_HOST;
});

afterEach(async () => {
  if (createdBookingIds.length > 0) {
    await prisma.booking.deleteMany({
      where: { id: { in: createdBookingIds.splice(0, createdBookingIds.length) } },
    });
  }

  if (createdCustomerIds.length > 0) {
    await prisma.customer.deleteMany({
      where: { id: { in: createdCustomerIds.splice(0, createdCustomerIds.length) } },
    });
  }

  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds.splice(0, createdUserIds.length) } },
    });
  }
});

after(async () => {
  await prisma.$disconnect();
});

describe("notification runner", () => {
  it("đánh dấu SKIPPED cho email hold confirm khi transport email đang tắt", async () => {
    const fixture = await createNotificationFixture({
      jobType: "BOOKING_HOLD_CONFIRM",
    });

    const result = await processDueNotificationJobs(10, { id: fixture.job.id });
    const job = await prisma.notificationJob.findUniqueOrThrow({
      where: { id: fixture.job.id },
    });

    assert.equal(result.claimed >= 1, true);
    assert.equal(job.status, NotificationJobStatus.SKIPPED);
    assert.equal(job.lastError, "EMAIL_TRANSPORT_DISABLED");
  });

  it("hủy reminder khi booking đã đủ tiền", async () => {
    const fixture = await createNotificationFixture({
      jobType: "PAYMENT_REMINDER_T_MINUS_2H",
      paymentAmount: 1_500_000,
      paymentStatus: PaymentStatus.PAID,
    });

    await processDueNotificationJobs(10, { id: fixture.job.id });
    const job = await prisma.notificationJob.findUniqueOrThrow({
      where: { id: fixture.job.id },
    });

    assert.equal(job.status, NotificationJobStatus.CANCELLED);
    assert.equal(job.lastError, "BALANCE_ALREADY_ZERO");
  });

  it("hủy reminder khi QR cũ không còn khớp balance hiện tại", async () => {
    const fixture = await createNotificationFixture({
      jobType: "PAYMENT_REMINDER_T_MINUS_30M",
      paymentAmount: 500_000,
      paymentStatus: PaymentStatus.PARTIAL,
      intentAmount: 1_500_000,
    });

    await processDueNotificationJobs(10, { id: fixture.job.id });
    const job = await prisma.notificationJob.findUniqueOrThrow({
      where: { id: fixture.job.id },
    });

    assert.equal(job.status, NotificationJobStatus.CANCELLED);
    assert.equal(job.lastError, "PAYMENT_INTENT_AMOUNT_OUTDATED");
  });

  it("giữ reminder SePay sau thanh toán một phần vì target amount là bất biến", async () => {
    const fixture = await createNotificationFixture({
      jobType: "PAYMENT_REMINDER_T_MINUS_30M",
      paymentAmount: 500_000,
      paymentStatus: PaymentStatus.PARTIAL,
      intentAmount: 1_500_000,
      provider: PaymentIntentProvider.SEPAY,
    });

    await processDueNotificationJobs(10, { id: fixture.job.id });
    const job = await prisma.notificationJob.findUniqueOrThrow({ where: { id: fixture.job.id } });

    assert.equal(job.status, NotificationJobStatus.SKIPPED);
    assert.equal(job.lastError, "EMAIL_TRANSPORT_DISABLED");
  });
});
