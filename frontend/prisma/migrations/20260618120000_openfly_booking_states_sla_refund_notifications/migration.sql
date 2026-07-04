-- OpenFly admin redesign · Phần C.1 + E
-- Đổi tên trạng thái BookingStatus cũ sang quy ước mới + thêm trạng thái luồng xuất vé/hoàn tiền,
-- thêm SLA/assignee cho Booking, model Refund, mở rộng NotificationJob (audience/idempotency/template).
--
-- AN TOÀN DỮ LIỆU:
--  * RENAME VALUE chỉ đổi nhãn trong catalog — mọi hàng đang là DRAFT/PRICING_PENDING/FAILED
--    tự động mang nhãn mới, KHÔNG cần migrate dữ liệu, gần như tức thời.
--  * Các cột mới đều nullable (hoặc NOT NULL + DEFAULT hằng) → không rewrite bảng, không khoá lâu.
--  * Yêu cầu PostgreSQL 12+ (Supabase PG15) để chạy nhiều ADD VALUE trong một migration.

-- AlterEnum: đổi tên 3 giá trị BookingStatus cũ (giữ nguyên dữ liệu)
ALTER TYPE "BookingStatus" RENAME VALUE 'DRAFT' TO 'QUOTED';
ALTER TYPE "BookingStatus" RENAME VALUE 'PRICING_PENDING' TO 'PENDING_PAYMENT';
ALTER TYPE "BookingStatus" RENAME VALUE 'FAILED' TO 'PAYMENT_FAILED';

-- AlterEnum: thêm 5 trạng thái cho hàng đợi xuất vé & hoàn tiền
ALTER TYPE "BookingStatus" ADD VALUE 'PAID';
ALTER TYPE "BookingStatus" ADD VALUE 'TICKETING';
ALTER TYPE "BookingStatus" ADD VALUE 'CANNOT_ISSUE';
ALTER TYPE "BookingStatus" ADD VALUE 'REFUND_REQUIRED';
ALTER TYPE "BookingStatus" ADD VALUE 'REFUNDED';

-- AlterEnum: kênh thông báo Zalo OA + ZNS
ALTER TYPE "NotificationJobChannel" ADD VALUE 'ZALO_OA';
ALTER TYPE "NotificationJobChannel" ADD VALUE 'ZNS';

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUIRED', 'PROCESSING', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationAudience" AS ENUM ('INTERNAL', 'CUSTOMER');

-- AlterTable: Booking — SLA xuất vé + người phụ trách + bàn giao RMS
ALTER TABLE "Booking"
  ADD COLUMN "paidConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "slaDueAt" TIMESTAMP(3),
  ADD COLUMN "assignedToId" TEXT,
  ADD COLUMN "rmsSyncedAt" TIMESTAMP(3);

-- AlterTable: NotificationJob — đối tượng nhận + chống enqueue trùng + mã template
ALTER TABLE "NotificationJob"
  ADD COLUMN "audience" "NotificationAudience" NOT NULL DEFAULT 'INTERNAL',
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "templateCode" TEXT;

-- CreateTable: Refund
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUIRED',
    "processedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refundedAt" TIMESTAMP(3),

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable: NotificationTemplate
CREATE TABLE "NotificationTemplate" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "znsTemplateId" TEXT,
    "sampleParams" JSONB,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationJob_idempotencyKey_key" ON "NotificationJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Booking_status_slaDueAt_idx" ON "Booking"("status", "slaDueAt");

-- CreateIndex
CREATE INDEX "Booking_assignedToId_status_idx" ON "Booking"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "Refund_bookingId_createdAt_idx" ON "Refund"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "Refund_status_createdAt_idx" ON "Refund"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
