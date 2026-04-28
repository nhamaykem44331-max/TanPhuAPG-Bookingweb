import { NextResponse } from "next/server";

import { syncExpiredBookingOrders } from "@/lib/bookings/orderManagement";
import { processDueNotificationJobs } from "@/lib/notifications/runner";

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
  const result = await processDueNotificationJobs();

  return NextResponse.json({
    ...result,
    expiredOrderCount: expiredOrders.filter((item) => item.expiredNow).length,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
