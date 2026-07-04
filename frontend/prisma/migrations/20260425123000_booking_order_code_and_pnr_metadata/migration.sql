-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "orderCode" TEXT;

-- AlterTable
ALTER TABLE "BookingPnr" ADD COLUMN "routeSummary" TEXT;
ALTER TABLE "BookingPnr" ADD COLUMN "departAt" TIMESTAMP(3);

-- Backfill Booking.orderCode for existing records
UPDATE "Booking"
SET "orderCode" = 'APG-'
  || to_char("createdAt" AT TIME ZONE 'Asia/Bangkok', 'YYMMDD')
  || '-'
  || upper(right(regexp_replace("id", '[^a-zA-Z0-9]', '', 'g'), 8))
WHERE "orderCode" IS NULL;

-- Backfill BookingPnr route summary from rawJson when available, otherwise use parent booking route
UPDATE "BookingPnr" AS p
SET
  "routeSummary" = COALESCE(
    CASE
      WHEN COALESCE(p."rawJson"->>'from', '') <> '' AND COALESCE(p."rawJson"->>'to', '') <> ''
        THEN upper(p."rawJson"->>'from') || '-' || upper(p."rawJson"->>'to')
      ELSE NULL
    END,
    b."routeSummary"
  ),
  "departAt" = COALESCE(p."departAt", b."departAt")
FROM "Booking" AS b
WHERE p."bookingId" = b."id";

-- Backfill Booking.ttlExpiresAt from earliest child PNR timelimit
UPDATE "Booking" AS b
SET "ttlExpiresAt" = child."earliestTimelimit"
FROM (
  SELECT
    "bookingId",
    MIN("timelimit") AS "earliestTimelimit"
  FROM "BookingPnr"
  WHERE "timelimit" IS NOT NULL
  GROUP BY "bookingId"
) AS child
WHERE b."id" = child."bookingId";

-- Finalize Booking.orderCode
ALTER TABLE "Booking" ALTER COLUMN "orderCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_orderCode_key" ON "Booking"("orderCode");

-- CreateIndex
CREATE INDEX "Booking_orderCode_idx" ON "Booking"("orderCode");

-- CreateIndex
CREATE INDEX "BookingPnr_bookingId_timelimit_idx" ON "BookingPnr"("bookingId", "timelimit");
