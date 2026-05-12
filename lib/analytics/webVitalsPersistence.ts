import { prisma } from "@/lib/db";
import {
  buildWebVitalsSnapshot,
  type WebVitalRecord,
  type WebVitalsSnapshot,
} from "@/lib/analytics/webVitals";

const MAX_DB_RECORDS = 2_000;
const RETENTION_DAYS = 30;

function dateFromTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function cutoffDate(now = Date.now()) {
  return new Date(now - RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export async function persistWebVitalRecord(record: WebVitalRecord) {
  try {
    await prisma.webVitalMetric.create({
      data: {
        metricId: record.id,
        name: record.name,
        label: record.label || null,
        value: record.value,
        rating: record.rating,
        startTime: record.startTime,
        navigationType: record.navigationType,
        path: record.path,
        userAgent: record.userAgent,
        ip: record.ip,
        observedAt: dateFromTimestamp(record.timestamp),
      },
    });

    if (Math.random() < 0.01) {
      await prisma.webVitalMetric.deleteMany({
        where: { observedAt: { lt: cutoffDate() } },
      });
    }
  } catch (error) {
    console.warn("[web-vitals] persistent write skipped", error);
  }
}

export async function getPersistentWebVitalsSnapshot(): Promise<WebVitalsSnapshot | null> {
  try {
    const rows = await prisma.webVitalMetric.findMany({
      orderBy: { observedAt: "desc" },
      take: MAX_DB_RECORDS,
    });

    const records: WebVitalRecord[] = rows.map((row) => ({
      id: row.metricId,
      name: row.name,
      label: row.label || "",
      value: row.value,
      rating: row.rating === "good" || row.rating === "needs-improvement" || row.rating === "poor"
        ? row.rating
        : null,
      startTime: row.startTime,
      navigationType: row.navigationType,
      path: row.path,
      timestamp: row.observedAt.getTime(),
      userAgent: row.userAgent,
      ip: row.ip,
    }));

    return buildWebVitalsSnapshot(records);
  } catch (error) {
    console.warn("[web-vitals] persistent read skipped", error);
    return null;
  }
}
