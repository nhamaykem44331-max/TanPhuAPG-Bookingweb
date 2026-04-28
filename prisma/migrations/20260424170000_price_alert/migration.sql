-- CreateEnum
CREATE TYPE "PriceAlertDir" AS ENUM ('BELOW', 'ABOVE');

-- CreateEnum
CREATE TYPE "PriceAlertStatus" AS ENUM ('ACTIVE', 'TRIGGERED', 'DISABLED');

-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "airline" TEXT,
    "targetPrice" INTEGER NOT NULL,
    "direction" "PriceAlertDir" NOT NULL,
    "status" "PriceAlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "triggeredAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceAlert_route_status_idx" ON "PriceAlert"("route", "status");

-- CreateIndex
CREATE INDEX "PriceAlert_createdById_createdAt_idx" ON "PriceAlert"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
