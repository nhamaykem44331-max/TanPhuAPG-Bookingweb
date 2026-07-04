import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AUDIT_VIEWER_ROLES } from "@/lib/auth/constants";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { prisma } from "@/lib/db";
import { buildAuditSummary, extractChangedFields } from "@/lib/audit/summary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const auditQuerySchema = z.object({
  actorId: z.string().cuid().optional(),
  entity: z.string().trim().max(40).optional(),
  action: z.string().trim().max(80).optional(),
  entityId: z.string().trim().max(120).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

function startOfDay(value: string): Date {
  return new Date(`${value}T00:00:00+07:00`);
}

function endOfDay(value: string): Date {
  return new Date(`${value}T23:59:59.999+07:00`);
}

function sevenDaysAgo(): Date {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date;
}

function validationError(error: z.ZodError) {
  return NextResponse.json(
    {
      error: "VALIDATION_ERROR",
      fieldErrors: error.flatten().fieldErrors,
    },
    { status: 422 },
  );
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(AUDIT_VIEWER_ROLES);

    const parsedQuery = auditQuerySchema.safeParse({
      actorId: request.nextUrl.searchParams.get("actorId") ?? undefined,
      entity: request.nextUrl.searchParams.get("entity") ?? undefined,
      action: request.nextUrl.searchParams.get("action") ?? undefined,
      entityId: request.nextUrl.searchParams.get("entityId") ?? undefined,
      from: request.nextUrl.searchParams.get("from") ?? undefined,
      to: request.nextUrl.searchParams.get("to") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      offset: request.nextUrl.searchParams.get("offset") ?? undefined,
    });

    if (!parsedQuery.success) {
      return validationError(parsedQuery.error);
    }

    const query = parsedQuery.data;
    const where = {
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.entity ? { entity: query.entity } : {}),
      ...(query.action ? { action: { contains: query.action, mode: "insensitive" as const } } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      createdAt: {
        gte: query.from ? startOfDay(query.from) : sevenDaysAgo(),
        ...(query.to ? { lte: endOfDay(query.to) } : {}),
      },
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: query.offset,
        take: query.limit,
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      items: logs.map((log) => ({
        id: log.id,
        actor: log.actor,
        entity: log.entity,
        entityId: log.entityId,
        action: log.action,
        before: log.before,
        after: log.after,
        changedFields: extractChangedFields(log),
        ip: log.ip,
        createdAt: log.createdAt.toISOString(),
        summary: buildAuditSummary(log),
      })),
      total,
      limit: query.limit,
      offset: query.offset,
    });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
