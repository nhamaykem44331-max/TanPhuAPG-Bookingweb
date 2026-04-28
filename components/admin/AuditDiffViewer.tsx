interface AuditDiffViewerProps {
  before: unknown;
  after: unknown;
}

function stringify(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}

export function AuditDiffViewer({ before, after }: AuditDiffViewerProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="apg-admin-stat overflow-hidden px-0 py-0">
        <div className="border-b border-[var(--apg-border-default)] px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">Before</div>
        </div>
        <pre className="max-h-[360px] overflow-auto bg-slate-950 px-4 py-4 text-xs leading-6 text-slate-50">
          {stringify(before)}
        </pre>
      </div>

      <div className="apg-admin-stat overflow-hidden px-0 py-0">
        <div className="border-b border-[var(--apg-border-default)] px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--apg-text-secondary)]">After</div>
        </div>
        <pre className="max-h-[360px] overflow-auto bg-slate-950 px-4 py-4 text-xs leading-6 text-slate-50">
          {stringify(after)}
        </pre>
      </div>
    </div>
  );
}
