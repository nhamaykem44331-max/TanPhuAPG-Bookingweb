-- CreateEnum
CREATE TYPE "BookingHoldAttemptStatus" AS ENUM ('PROCESSING', 'UPSTREAM_COMPLETED', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "PaymentIntent" ADD COLUMN "activeKey" TEXT;

-- CreateTable
CREATE TABLE "BookingHoldAttempt" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" "BookingHoldAttemptStatus" NOT NULL DEFAULT 'PROCESSING',
    "holdResult" JSONB,
    "bookingId" TEXT,
    "safeToRetry" BOOLEAN NOT NULL DEFAULT false,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingHoldAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_activeKey_key" ON "PaymentIntent"("activeKey");

-- CreateIndex
CREATE UNIQUE INDEX "BookingHoldAttempt_idempotencyKey_key" ON "BookingHoldAttempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "BookingHoldAttempt_bookingId_idx" ON "BookingHoldAttempt"("bookingId");

-- CreateIndex
CREATE INDEX "BookingHoldAttempt_status_updatedAt_idx" ON "BookingHoldAttempt"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "BookingHoldAttempt" ADD CONSTRAINT "BookingHoldAttempt_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
