-- P2 persistent observability and durable logo cache

CREATE TABLE "WebVitalMetric" (
    "id" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT,
    "value" DOUBLE PRECISION NOT NULL,
    "rating" TEXT,
    "startTime" DOUBLE PRECISION,
    "navigationType" TEXT,
    "path" TEXT NOT NULL DEFAULT '/',
    "userAgent" TEXT,
    "ip" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebVitalMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AirlineLogoCache" (
    "code" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AirlineLogoCache_pkey" PRIMARY KEY ("code")
);

CREATE INDEX "WebVitalMetric_observedAt_idx" ON "WebVitalMetric"("observedAt");
CREATE INDEX "WebVitalMetric_name_observedAt_idx" ON "WebVitalMetric"("name", "observedAt");
CREATE INDEX "WebVitalMetric_path_observedAt_idx" ON "WebVitalMetric"("path", "observedAt");
CREATE INDEX "WebVitalMetric_metricId_idx" ON "WebVitalMetric"("metricId");
CREATE INDEX "AirlineLogoCache_updatedAt_idx" ON "AirlineLogoCache"("updatedAt");
