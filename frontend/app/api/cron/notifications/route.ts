import { NextResponse } from "next/server";

import { syncExpiredBookingOrders } from "@/lib/bookings/orderManagement";
import { syncOpenNamThanhBookings } from "@/lib/bookings/namthanhStatusSync";
import { processDueNotificationJobs } from "@/lib/notifications/runner";
import { sweepHeldExpiring, sweepPaidOverSla } from "@/lib/notifications/sweeps";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return false;
  }

  const bearer = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");

  return bearer === `Bearer ${secret}` || headerSecret === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const expiredOrders = await syncExpiredBookingOrders();
  const namThanhSync = await syncOpenNamThanhBookings();
  // Quét SLA/timelimit trước để job mới đẩy ra được gửi ngay trong cùng nhịp cron.
  const slaBreaches = await sweepPaidOverSla();
  const heldExpiring = await sweepHeldExpiring();
  const result = await processDueNotificationJobs();

  return NextResponse.json({
    ...result,
    slaBreachJobs: slaBreaches,
    heldExpiringJobs: heldExpiring,
    expiredOrderCount: expiredOrders.filter((item) => item.expiredNow).length,
    namThanhSyncCount: namThanhSync.filter((item) => item.synced).length,
    namThanhSyncFailedCount: namThanhSync.filter((item) => item.error).length,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
