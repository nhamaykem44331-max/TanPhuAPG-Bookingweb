import { TrendingDown, TrendingUp } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { Sparkline } from "./Charts";

// Ô KPI theo Manager (`kit.tsx` → StatCard / StatTile). Trung tính (không "use client").

export interface StatCardProps {
  /** Nhãn eyebrow phía trên. */
  label: ReactNode;
  /** Số lớn (Fraunces 34px). */
  value: ReactNode;
  /** Đơn vị đứng cạnh số lớn (Fraunces 16px in nghiêng). */
  unit?: ReactNode;
  /** Dòng phụ dưới số lớn. */
  sub?: ReactNode;
  /** Chuỗi delta, vd "+12,4%". */
  delta?: ReactNode;
  /** "down" → đỏ, còn lại → xanh. */
  deltaTone?: "up" | "down";
  /** Thẻ nhấn: viền --ink, số lớn màu --rust. */
  accent?: boolean;
  /** Dãy số vẽ sparkline góc phải. */
  spark?: number[];
  /** Màu sparkline (mặc định --rust). */
  sparkColor?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function StatCard({
  label,
  value,
  unit,
  sub,
  delta,
  deltaTone,
  accent,
  spark,
  sparkColor,
  children,
  className,
  style,
}: StatCardProps) {
  const down = deltaTone === "down";
  return (
    <div
      className={`flex min-h-[128px] flex-col justify-between rounded-[12px] border bg-[var(--paper)] px-[20px] pb-[16px] pt-[18px] ${className ?? ""}`}
      style={{ borderColor: accent ? "var(--ink)" : "var(--line)", ...style }}
    >
      <div className="flex items-start justify-between gap-[10px]">
        <span className="text-[10.5px] font-semibold uppercase leading-none tracking-[1.5px] text-[var(--ink3)]">
          {label}
        </span>
        {delta != null ? (
          <span
            className="inline-flex items-center gap-[3px] text-[12px] font-semibold"
            style={{ color: down ? "var(--red)" : "var(--green)" }}
          >
            {down ? <TrendingDown size={13} strokeWidth={1.9} /> : <TrendingUp size={13} strokeWidth={1.9} />}
            {delta}
          </span>
        ) : null}
      </div>

      <div className="mt-3">
        <div className="flex items-end justify-between gap-[10px]">
          <div className="flex min-w-0 items-baseline gap-1">
            <span
              className="ofly-serif text-[34px] font-medium leading-none tracking-[-1.4px]"
              style={{ color: accent ? "var(--rust)" : "var(--ink)" }}
            >
              {value}
            </span>
            {unit ? <span className="ofly-serif text-[16px] italic text-[var(--ink3)]">{unit}</span> : null}
          </div>
          {spark && spark.length > 1 ? (
            <Sparkline data={spark} color={sparkColor ?? "var(--rust)"} w={72} h={26} fill />
          ) : null}
        </div>
        {sub ? <div className="mt-2 text-[12px] text-[var(--ink3)]">{sub}</div> : null}
        {children}
      </div>
    </div>
  );
}

export type StatTileTone = "plain" | "rust" | "red" | "amber" | "green" | "navy";

// Bảng tone: nền/viền dựng bằng color-mix từ token để dark mode tự chỉnh.
// Ngoại lệ #FFFFFF: chữ trên khối navy đặc (§1 hợp đồng cho phép).
const TILE: Record<StatTileTone, { bg: string; bd: string; lab: string; val: string }> = {
  plain: { bg: "var(--paper)", bd: "var(--line)", lab: "var(--ink3)", val: "var(--ink)" },
  rust: { bg: "var(--paper)", bd: "var(--line)", lab: "var(--ink3)", val: "var(--rust)" },
  red: {
    bg: "color-mix(in srgb, var(--red) 7%, transparent)",
    bd: "color-mix(in srgb, var(--red) 24%, transparent)",
    lab: "var(--red)",
    val: "var(--red)",
  },
  amber: {
    bg: "color-mix(in srgb, var(--amber) 8%, transparent)",
    bd: "color-mix(in srgb, var(--amber) 26%, transparent)",
    lab: "var(--amber)",
    val: "var(--amber)",
  },
  green: {
    bg: "var(--greenTint)",
    bd: "color-mix(in srgb, var(--green) 26%, transparent)",
    lab: "var(--green)",
    val: "var(--green)",
  },
  navy: { bg: "var(--navy)", bd: "var(--navy)", lab: "rgba(255,255,255,0.65)", val: "#FFFFFF" },
};

export interface StatTileProps {
  label: ReactNode;
  value: ReactNode;
  /** Hậu tố nhỏ cạnh giá trị (vd "đơn"). */
  sub?: ReactNode;
  tone?: StatTileTone;
  minWidth?: number;
  className?: string;
}

export function StatTile({ label, value, sub, tone = "plain", minWidth = 130, className }: StatTileProps) {
  const t = TILE[tone] ?? TILE.plain;
  const subColor = tone === "plain" || tone === "rust" ? "var(--ink3)" : t.lab;
  return (
    <div
      className={`flex flex-col justify-center rounded-[10px] border px-[16px] py-[10px] ${className ?? ""}`}
      style={{ background: t.bg, borderColor: t.bd, minWidth }}
    >
      <span
        className="text-[10px] font-semibold uppercase leading-none tracking-[1px]"
        style={{ color: t.lab }}
      >
        {label}
      </span>
      <span
        className="ofly-num mt-1 whitespace-nowrap text-[20px] font-bold leading-none"
        style={{ color: t.val }}
      >
        {value}
        {sub ? (
          <span className="ofly-sans ml-[6px] text-[11px] font-semibold" style={{ color: subColor }}>
            {sub}
          </span>
        ) : null}
      </span>
    </div>
  );
}
