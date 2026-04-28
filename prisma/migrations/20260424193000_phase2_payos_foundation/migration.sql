-- CreateEnum
CREATE TYPE "PaymentIntentProvider" AS ENUM ('PAYOS');

-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('PENDING', 'PAID', 'PARTIAL', 'MANUAL_REVIEW', 'EXPIRED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "BankTransactionStatus" AS ENUM ('RECEIVED', 'MATCHED', 'DUPLICATE', 'MANUAL_REVIEW', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationJobChannel" AS ENUM ('EMAIL', 'SLACK', 'TELEGRAM', 'INTERNAL');

-- CreateEnum
CREATE TYPE "NotificationJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "paymentIntentId" TEXT;

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "provider" "PaymentIntentProvider" NOT NULL DEFAULT 'PAYOS',
    "providerOrderCode" TEXT NOT NULL,
    "paymentLinkId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT NOT NULL,
    "transferContent" TEXT NOT NULL,
    "checkoutUrl" TEXT,
    "qrCode" TEXT,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "bin" TEXT,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "rawJson" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "provider" "PaymentIntentProvider" NOT NULL DEFAULT 'PAYOS',
    "dedupeKey" TEXT NOT NULL,
    "providerOrderCode" TEXT,
    "paymentLinkId" TEXT,
    "reference" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "description" TEXT,
    "accountNumber" TEXT,
    "transactionDateTime" TIMESTAMP(3),
    "counterAccountBankId" TEXT,
    "counterAccountBankName" TEXT,
    "counterAccountName" TEXT,
    "counterAccountNumber" TEXT,
    "virtualAccountName" TEXT,
    "virtualAccountNumber" TEXT,
    "status" "BankTransactionStatus" NOT NULL DEFAULT 'RECEIVED',
    "paymentIntentId" TEXT,
    "paymentId" TEXT,
    "manualReviewReason" TEXT,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" "NotificationJobChannel" NOT NULL,
    "status" "NotificationJobStatus" NOT NULL DEFAULT 'PENDING',
    "bookingId" TEXT,
    "customerId" TEXT,
    "paymentIntentId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_paymentIntentId_createdAt_idx" ON "Payment"("paymentIntentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_providerOrderCode_key" ON "PaymentIntent"("providerOrderCode");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_paymentLinkId_key" ON "PaymentIntent"("paymentLinkId");

-- CreateIndex
CREATE INDEX "PaymentIntent_bookingId_createdAt_idx" ON "PaymentIntent"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentIntent_provider_status_createdAt_idx" ON "PaymentIntent"("provider", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentIntent_status_expiresAt_idx" ON "PaymentIntent"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransaction_dedupeKey_key" ON "BankTransaction"("dedupeKey");

-- CreateIndex
CREATE INDEX "BankTransaction_providerOrderCode_idx" ON "BankTransaction"("providerOrderCode");

-- CreateIndex
CREATE INDEX "BankTransaction_paymentLinkId_idx" ON "BankTransaction"("paymentLinkId");

-- CreateIndex
CREATE INDEX "BankTransaction_paymentIntentId_createdAt_idx" ON "BankTransaction"("paymentIntentId", "createdAt");

-- CreateIndex
CREATE INDEX "BankTransaction_status_createdAt_idx" ON "BankTransaction"("status", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationJob_status_scheduledAt_idx" ON "NotificationJob"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "NotificationJob_bookingId_type_idx" ON "NotificationJob"("bookingId", "type");

-- CreateIndex
CREATE INDEX "NotificationJob_paymentIntentId_type_idx" ON "NotificationJob"("paymentIntentId", "type");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationJob" ADD CONSTRAINT "NotificationJob_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationJob" ADD CONSTRAINT "NotificationJob_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
