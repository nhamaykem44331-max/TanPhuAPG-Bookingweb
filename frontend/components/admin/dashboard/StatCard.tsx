interface StatCardProps {
  label: string;
  value: string;
  helper: string;
  tone?: "navy" | "emerald" | "amber" | "slate";
}

const TONE_META: Record<NonNullable<StatCardProps["tone"]>, { dot: string; value: string }> = {
  navy: {
    dot: "bg-cyan-400",
    value: "text-cyan-300",
  },
  emerald: {
    dot: "bg-lime-400",
    value: "text-lime-300",
  },
  amber: {
    dot: "bg-amber-400",
    value: "text-amber-300",
  },
  slate: {
    dot: "bg-rose-400",
    value: "text-rose-300",
  },
};

export function StatCard({ label, value, helper, tone = "navy" }: StatCardProps) {
  const toneMeta = TONE_META[tone];

  return (
    <article className="rounded-xl border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--apg-text-muted)]">
        <span className={`h-1.5 w-1.5 rounded-full ${toneMeta.dot}`} />
        {label}
      </div>
      <div className={`apg-tabular mt-3 text-2xl font-semibold tracking-tight ${toneMeta.value}`}>{value}</div>
      <div className="mt-2 text-xs leading-5 text-[var(--apg-text-secondary)]">{helper}</div>
    </article>
  );
}
