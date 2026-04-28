import Link from "next/link";

import { AUDIT_VIEWER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { prisma } from "@/lib/db";
import { buildAuditSummary, extractChangedFields } from "@/lib/audit/summary";
import { AuditTable } from "@/components/admin/AuditTable";

interface AuditPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

function singleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

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

export default async function AuditPage({ searchParams }: AuditPageProps) {
  await requireRole(AUDIT_VIEWER_ROLES);

  const actorId = singleValue(searchParams?.actorId);
  const entity = singleValue(searchParams?.entity);
  const action = singleValue(searchParams?.action);
  const entityId = singleValue(searchParams?.entityId);
  const from = singleValue(searchParams?.from);
  const to = singleValue(searchParams?.to);
  const limit = Number(singleValue(searchParams?.limit) ?? 100);
  const offset = Number(singleValue(searchParams?.offset) ?? 0);
  const where = {
    ...(actorId ? { actorId } : {}),
    ...(entity ? { entity } : {}),
    ...(action ? { action: { contains: action, mode: "insensitive" as const } } : {}),
    ...(entityId ? { entityId } : {}),
    createdAt: {
      gte: from ? startOfDay(from) : sevenDaysAgo(),
      ...(to ? { lte: endOfDay(to) } : {}),
    },
  };

  const [logs, total, users] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: Math.min(Math.max(limit, 1), 100),
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
    prisma.user.findMany({
      orderBy: { email: "asc" },
      select: {
        id: true,
        email: true,
        fullName: true,
      },
    }),
  ]);

  const previousOffset = Math.max(offset - limit, 0);
  const nextOffset = offset + limit;
  const hasNextPage = nextOffset < total;
  const baseQuery = Object.fromEntries(
    Object.entries({ actorId, entity, action, entityId, from, to, limit: String(limit) }).filter((entry) => entry[1]),
  );

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-base font-semibold text-[var(--apg-text-primary)]">Audit Log</h1>
          <p className="mt-1 text-sm text-[var(--apg-text-secondary)]">Mặc định 7 ngày gần nhất, mở từng dòng để xem diff.</p>
        </div>
        <span className="rounded-md border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-3 py-2 text-sm text-[var(--apg-text-secondary)]">
          {total} log
        </span>
      </section>

      <section className="apg-admin-toolbar px-4 py-4">
        <form className="grid gap-3 xl:grid-cols-[180px_140px_180px_180px_150px_150px_100px_auto_auto] xl:items-end">
          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Actor
            <select className="apg-field mt-2" defaultValue={actorId ?? ""} name="actorId">
              <option value="">Tất cả</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Entity
            <input className="apg-field mt-2" defaultValue={entity ?? ""} name="entity" placeholder="Booking" />
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Action
            <input className="apg-field mt-2" defaultValue={action ?? ""} name="action" placeholder="booking.cancel" />
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Entity ID
            <input className="apg-field mt-2" defaultValue={entityId ?? ""} name="entityId" />
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Từ ngày
            <input className="apg-field mt-2" defaultValue={from ?? ""} name="from" type="date" />
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Đến ngày
            <input className="apg-field mt-2" defaultValue={to ?? ""} name="to" type="date" />
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Limit
            <input className="apg-field mt-2" defaultValue={String(limit)} min={1} max={100} name="limit" type="number" />
          </label>

          <input name="offset" type="hidden" value="0" />
          <button className="apg-btn-primary w-full" type="submit">
            Lọc
          </button>
          <Link className="apg-btn-secondary inline-flex w-full items-center justify-center" href="/admin/audit">
            Xóa lọc
          </Link>
        </form>
      </section>

      <AuditTable
        items={logs.map((log) => ({
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
        }))}
      />

      <div className="flex items-center justify-between rounded-lg border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-4 py-3">
        <Link
          className={`apg-btn-secondary ${offset === 0 ? "pointer-events-none opacity-50" : ""}`}
          href={{ pathname: "/admin/audit", query: { ...baseQuery, offset: String(previousOffset) } }}
        >
          Trang trước
        </Link>
        <div className="text-sm text-[var(--apg-text-secondary)]">
          Hiển thị {logs.length} / {total}
        </div>
        <Link
          className={`apg-btn-secondary ${!hasNextPage ? "pointer-events-none opacity-50" : ""}`}
          href={{ pathname: "/admin/audit", query: { ...baseQuery, offset: String(nextOffset) } }}
        >
          Trang sau
        </Link>
      </div>
    </div>
  );
}
