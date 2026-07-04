import { NextRequest, NextResponse } from "next/server";

import { TICKETING_QUEUE_ROLES } from "@/lib/auth/constants";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { listTicketingQueue } from "@/lib/bookings/ticketingQueue";
import { ticketingQueueQuerySchema } from "@/lib/bookings/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(TICKETING_QUEUE_ROLES);

    const parsedQuery = ticketingQueueQuerySchema.safeParse({
      assignedToId: request.nextUrl.searchParams.get("assignedToId") ?? undefined,
      unassigned: request.nextUrl.searchParams.get("unassigned") ?? undefined,
      overdueOnly: request.nextUrl.searchParams.get("overdueOnly") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      offset: request.nextUrl.searchParams.get("offset") ?? undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          fieldErrors: parsedQuery.error.flatten().fieldErrors,
        },
        { status: 422 },
      );
    }

    const result = await listTicketingQueue(parsedQuery.data, {
      userId: session.user.id,
      role: session.user.role,
    });

    return NextResponse.json(result);
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
