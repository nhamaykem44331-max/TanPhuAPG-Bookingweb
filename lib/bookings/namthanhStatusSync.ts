import { BookingStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getNamThanhBookingStatus, type NamThanhBookingStatusResponse } from "@/lib/namthanh";

type NamThanhPnr = NonNullable<NamThanhBookingStatusResponse["pnrs"]>[number];

export interface NamThanhStatusSyncResult {
  bookingId: string;
  synced: boolean;
  pnrCount: number;
  skipped?: string;
  error?: string;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function plainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizePnr(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

function parseNamThanhDateTime(value: unknown): Date | null {
  const text = String(value || "").trim();
  if (!text) return null;

  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) return direct;

  const match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return null;

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);
  const hour = Number.parseInt(match[4] || "0", 10);
  const minute = Number.parseInt(match[5] || "0", 10);
  const second = Number.parseInt(match[6] || "0", 10);
  const parsed = new Date(year, month - 1, day, hour, minute, second);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function earliestDate(values: Array<Date | null>): Date | null {
  return values
    .filter((value): value is Date => !!value)
    .sort((left, right) => left.getTime() - right.getTime())[0] ?? null;
}

function routeSummaryFromPnr(pnr: NamThanhPnr): string | null {
  const from = String(pnr.from || "").trim().toUpperCase();
  const to = String(pnr.to || "").trim().toUpperCase();
  return from && to ? `${from}-${to}` : null;
}

export async function syncNamThanhBookingStatus(bookingId: string): Promise<NamThanhStatusSyncResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      pnr: true,
      sessionId: true,
      ttlExpiresAt: true,
      namthanhRawJson: true,
    },
  });

  if (!booking) {
    return { bookingId, synced: false, pnrCount: 0, skipped: "BOOKING_NOT_FOUND" };
  }

  if (!booking.sessionId) {
    return { bookingId, synced: false, pnrCount: 0, skipped: "NO_SESSION_ID" };
  }

  const status = await getNamThanhBookingStatus(booking.sessionId);
  const pnrs = (status.pnrs || [])
    .map((pnr) => ({ ...pnr, pnr: normalizePnr(pnr.pnr || pnr.message) }))
    .filter((pnr) => pnr.pnr);

  if (pnrs.length === 0) {
    return { bookingId, synced: false, pnrCount: 0, skipped: "NO_PNR_RETURNED" };
  }

  const ttlExpiresAt = earliestDate(pnrs.map((pnr) => parseNamThanhDateTime(pnr.timelimit)));
  const firstPnr = pnrs[0]?.pnr ?? null;
  const rawJson = plainRecord(booking.namthanhRawJson);

  await prisma.$transaction(async (tx) => {
    for (const pnr of pnrs) {
      const existing = await tx.bookingPnr.findFirst({
        where: {
          bookingId,
          OR: [
            { pnr: pnr.pnr },
            { pnr: `PENDING-${bookingId}` },
          ],
        },
        orderBy: { createdAt: "asc" },
      });

      const data = {
        airline: pnr.airline || null,
        pnr: pnr.pnr,
        status: pnr.status || null,
        routeSummary: routeSummaryFromPnr(pnr),
        timelimit: parseNamThanhDateTime(pnr.timelimit),
        rawJson: toJsonValue(pnr),
      };

      if (existing) {
        await tx.bookingPnr.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await tx.bookingPnr.create({
          data: {
            bookingId,
            ...data,
          },
        });
      }
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        pnr: booking.pnr || firstPnr,
        ttlExpiresAt: ttlExpiresAt ?? booking.ttlExpiresAt,
        namthanhRawJson: toJsonValue({
          ...rawJson,
          latestStatus: status,
          latestStatusSyncedAt: new Date().toISOString(),
        }),
      },
    });
  });

  return { bookingId, synced: true, pnrCount: pnrs.length };
}

export async function syncOpenNamThanhBookings(limit = 20): Promise<NamThanhStatusSyncResult[]> {
  const now = new Date();
  const bookings = await prisma.booking.findMany({
    where: {
      source: "namthanh",
      status: BookingStatus.HELD,
      sessionId: { not: null },
      OR: [
        { ttlExpiresAt: null },
        { ttlExpiresAt: { gt: now } },
      ],
    },
    orderBy: { updatedAt: "asc" },
    select: { id: true },
    take: limit,
  });

  const results: NamThanhStatusSyncResult[] = [];

  for (const booking of bookings) {
    try {
      results.push(await syncNamThanhBookingStatus(booking.id));
    } catch (error) {
      results.push({
        bookingId: booking.id,
        synced: false,
        pnrCount: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
