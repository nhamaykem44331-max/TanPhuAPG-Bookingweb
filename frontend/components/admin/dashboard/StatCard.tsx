interface StatCardProps {
  label: string;
  value: string;
  helper: string;
  tone?: "navy" | "emerald" | "amber" | "slate";
}

// Dùng token tone của `.ofly` thay cho bảng màu mặc định Tailwind: màu Tailwind cố định
// nên không đổi theo theme sáng/tối của admin shell.
const TONE_META: Record<NonNullable<StatCardProps["tone"]>, { dot: string; value: string }> = {
  navy: {
    dot: "bg-[var(--tone-info-solid)]",
    value: "text-[var(--tone-info-fg)]",
  },
  emerald: {
    dot: "bg-[var(--tone-ok-solid)]",
    value: "text-[var(--tone-ok-fg)]",
  },
  amber: {
    dot: "bg-[var(--tone-warn-solid)]",
    value: "text-[var(--tone-warn-fg)]",
  },
  slate: {
    dot: "bg-[var(--tone-red-solid)]",
    value: "text-[var(--tone-red-fg)]",
  },
};

export function StatCard({ label, value, helper, tone = "navy" }: StatCardProps) {
  const toneMeta = TONE_META[tone];

  return (
    // Token `--apg-*` thuộc scope `.apg-admin-shell` (hệ cũ), shell mới chỉ gắn `.ofly` nên
    // phải chuyển sang token canon paper/line/ink của `.ofly`.
    <article className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink3)]">
        <span className={`h-1.5 w-1.5 rounded-full ${toneMeta.dot}`} />
        {label}
      </div>
      <div className={`apg-tabular mt-3 text-2xl font-semibold tracking-tight ${toneMeta.value}`}>{value}</div>
      <div className="mt-2 text-xs leading-5 text-[var(--ink2)]">{helper}</div>
    </article>
  );
}
