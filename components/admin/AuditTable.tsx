import { AuditDiffViewer } from "@/components/admin/AuditDiffViewer";

interface AuditItem {
  id: string;
  actor: { id: string; email: string; fullName: string } | null;
  entity: string;
  entityId: string;
  action: string;
  before: unknown;
  after: unknown;
  changedFields: string[];
  ip: string | null;
  createdAt: string;
  summary: string;
}

interface AuditTableProps {
  items: AuditItem[];
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

export function AuditTable({ items }: AuditTableProps) {
  if (items.length === 0) {
    return (
      <div className="apg-admin-sheet p-8">
        <div className="mx-auto max-w-xl text-center">
          <h3 className="text-base font-semibold text-[var(--apg-text-primary)]">Không có audit log phù hợp</h3>
          <p className="mt-2 text-sm text-[var(--apg-text-secondary)]">Nới actor, action hoặc khoảng thời gian để đọc thêm lịch sử thay đổi.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="apg-admin-sheet overflow-hidden">
      <div className="divide-y divide-[var(--apg-border-default)]">
        {items.map((item) => (
          <details key={item.id} className="group">
            <summary className="grid cursor-pointer list-none gap-3 px-4 py-3 text-sm hover:bg-[var(--apg-admin-table-hover)] md:grid-cols-[160px_minmax(0,1fr)_180px_150px] md:items-center">
              <div>
                <span className="rounded-full border border-[var(--apg-border-default)] px-2.5 py-1 text-[11px] font-semibold text-[var(--apg-text-secondary)]">
                  {item.entity}
                </span>
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold text-[var(--apg-text-primary)]">{item.summary}</div>
                <div className="mt-0.5 truncate text-xs text-[var(--apg-text-muted)]">{item.action} · {item.entityId}</div>
              </div>
              <div className="truncate text-xs text-[var(--apg-text-secondary)]">{item.actor?.email ?? "system"}</div>
              <div className="apg-tabular text-xs text-[var(--apg-text-muted)]">{formatDateTime(item.createdAt)}</div>
            </summary>

            <div className="border-t border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-muted)] px-4 py-4">
              <div className="mb-3 flex flex-wrap gap-2 text-xs text-[var(--apg-text-secondary)]">
                <span>IP {item.ip ?? "-"}</span>
                <span>Changed: {item.changedFields.length ? item.changedFields.join(", ") : "-"}</span>
              </div>
              <AuditDiffViewer after={item.after} before={item.before} />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
