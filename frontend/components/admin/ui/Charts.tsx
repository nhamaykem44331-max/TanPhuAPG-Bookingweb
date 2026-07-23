import type { ReactNode } from "react";

import { toneVars, type Tone } from "@/lib/admin/ui/tones";

// Biểu đồ SVG phẳng theo Manager: chuỗi chính --rust (tone "rust"), chuỗi phụ --blue
// (tone "info"), rồi --green (tone "ok") / --amber (tone "warn"). Vùng tô dùng gradient
// currentColor 0.18 → 0 (giống Sparkline trong `ui.tsx`), lưới/trục --line, nhãn trục
// sans 11px --ink3, số dùng mono (.ofly-num).

const VI = new Intl.NumberFormat("vi-VN");

// ---- Sparkline 78×26 (KPI card) -------------------------------------------
interface SparklineProps {
  values?: number[];
  /** Alias kiểu Manager (`ui.tsx` → Sparkline nhận `data`). */
  data?: number[];
  tone?: Tone;
  /** Màu trực tiếp (vd "var(--blue)") — ưu tiên hơn `tone` khi có. */
  color?: string;
  width?: number;
  height?: number;
  /** Alias ngắn kiểu Manager. */
  w?: number;
  h?: number;
  /** Tô vùng dưới đường bằng gradient currentColor 0.18 → 0. */
  fill?: boolean;
}

export function Sparkline({
  values,
  data,
  tone = "rust",
  color,
  width = 78,
  height = 26,
  w,
  h,
  fill = false,
}: SparklineProps) {
  const series = data ?? values ?? [];
  if (series.length === 0) return null;
  const accent = color ?? toneVars(tone).solid;
  const W = w ?? width;
  const H = h ?? height;
  const p = 3;
  const mx = Math.max(...series);
  const mn = Math.min(...series);
  const rng = mx - mn || 1;
  const st = series.length > 1 ? (W - p * 2) / (series.length - 1) : 0;
  const pts = series.map(
    (v, i) =>
      [
        Number((p + i * st).toFixed(1)),
        Number((H - p - ((v - mn) / rng) * (H - p * 2)).toFixed(1)),
      ] as const,
  );
  const d = "M" + pts.map((q) => q.join(" ")).join(" L");
  const area = `${d} L${pts[pts.length - 1][0]} ${H} L${pts[0][0]} ${H} Z`;
  const last = pts[pts.length - 1];
  // Id gradient suy ra từ MÀU: trong SVG, `currentColor` ở stop lấy theo <svg> chứa def,
  // nên hai sparkline khác màu phải có id khác nhau; cùng màu thì dùng chung def là đúng.
  const gid = `ofly-spark-${accent.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      fill="none"
      aria-hidden="true"
      style={{ flex: "none", overflow: "visible", color: accent }}
    >
      {fill ? (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.18} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gid})`} stroke="none" />
        </>
      ) : null}
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r={2.6} fill="currentColor" />
    </svg>
  );
}

// ---- AreaChart (vé xuất 14 ngày) ------------------------------------------
interface AreaChartProps {
  values: number[];
  labels?: string[];
  tone?: Tone;
  height?: number;
}

export function AreaChart({ values, labels, tone = "rust", height = 188 }: AreaChartProps) {
  if (values.length === 0) return null;
  const accent = toneVars(tone).solid;
  const w = 640;
  const pL = 6;
  const pR = 6;
  const pT = 18;
  const pB = 26;
  const n = values.length;
  const mx = Math.max(...values) * 1.12 || 1;
  const xs = n > 1 ? (w - pL - pR) / (n - 1) : 0;
  const pts = values.map((v, i) => ({
    x: Number((pL + i * xs).toFixed(1)),
    y: Number((height - pB - (v / mx) * (height - pT - pB)).toFixed(1)),
  }));
  const line = "M" + pts.map((q) => q.x + " " + q.y).join(" L");
  const area = line + " L" + pts[n - 1].x + " " + (height - pB) + " L" + pts[0].x + " " + (height - pB) + " Z";
  const avg = values.reduce((a, b) => a + b, 0) / n;
  const avgY = Number((height - pB - (avg / mx) * (height - pT - pB)).toFixed(1));
  const last = pts[n - 1];

  return (
    <div>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        preserveAspectRatio="none"
        width="100%"
        height={height + 2}
        style={{ display: "block", color: accent }}
      >
        {/* Id kèm tone: `currentColor` ở stop lấy theo <svg> chứa def → mỗi màu một id */}
        <defs>
          <linearGradient id={`ofly-area-${tone}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.18} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#ofly-area-${tone})`} stroke="none" />
        <line
          x1={pL}
          y1={avgY}
          x2={w - pR}
          y2={avgY}
          stroke="var(--line2)"
          strokeWidth={1}
          strokeDasharray="5 5"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={last.x} cy={last.y} r={4.5} fill="currentColor" stroke="var(--paper)" strokeWidth={2.5} />
      </svg>
      {labels && labels.length > 0 ? (
        <div className="mt-2 flex justify-between text-[11px] text-[var(--ink3)]">
          {labels.map((l, i) => (
            <span key={`${l}-${i}`}>{l}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---- DonutChart (phân bổ trạng thái) --------------------------------------
export interface DonutSegment {
  label: string;
  value: number;
  tone: Tone;
}

interface DonutChartProps {
  segments: DonutSegment[];
  caption?: string;
  size?: number;
  legend?: boolean;
}

export function DonutChart({ segments, caption = "ĐƠN", size = 140, legend = true }: DonutChartProps) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = 54;
  const c = 2 * Math.PI * r;
  let cum = 0;
  const segs = segments.map((s) => {
    const frac = total > 0 ? s.value / total : 0;
    const len = frac * c;
    const seg = {
      ...s,
      solid: toneVars(s.tone).solid,
      dasharray: `${len.toFixed(2)} ${(c - len).toFixed(2)}`,
      dashoffset: (-cum).toFixed(2),
      pct: Math.round(frac * 100),
    };
    cum += len;
    return seg;
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-[22px]">
      <div className="relative flex-none" style={{ width: size, height: size }}>
        <svg viewBox="0 0 140 140" width={size} height={size}>
          <circle cx={70} cy={70} r={r} fill="none" stroke="var(--paper2)" strokeWidth={18} />
          {segs.map((s) => (
            <circle
              key={s.label}
              cx={70}
              cy={70}
              r={r}
              fill="none"
              stroke={s.solid}
              strokeWidth={18}
              strokeDasharray={s.dasharray}
              strokeDashoffset={s.dashoffset}
              transform="rotate(-90 70 70)"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* Số tổng ở giữa = số lớn dạng hiển thị → Fraunces (§2 hợp đồng) */}
          <span className="ofly-serif text-[30px] font-medium leading-none text-[var(--ink)]">
            {VI.format(total)}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[1px] text-[var(--ink3)]">{caption}</span>
        </div>
      </div>

      {legend ? (
        <div className="flex w-full flex-col gap-[9px] sm:flex-1">
          {segs.map((s) => (
            <div key={s.label} className="flex items-center gap-[9px]">
              <span className="h-[9px] w-[9px] flex-none rounded-[3px]" style={{ background: s.solid }} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--ink2)]">{s.label}</span>
              <span className="ofly-num text-[12.5px] font-semibold text-[var(--ink)]">{VI.format(s.value)}</span>
              <span className="ofly-num w-[36px] text-right text-[11px] text-[var(--ink3)]">{s.pct}%</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---- Gauge (xuất đúng hạn SLA) --------------------------------------------
interface GaugeProps {
  /** Tỉ lệ 0..1 (hoặc dùng value/max). */
  value: number;
  max?: number;
  tone?: Tone;
  valueLabel?: string;
  caption?: string;
}

export function Gauge({ value, max = 1, tone = "ok", valueLabel, caption }: GaugeProps) {
  const frac = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const color = toneVars(tone).solid;
  const gR = 84;
  const gx = 100;
  const gy = 100;
  const gL = Math.PI * gR;
  const path = `M ${gx - gR} ${gy} A ${gR} ${gR} 0 0 1 ${gx + gR} ${gy}`;
  const dash = `${(frac * gL).toFixed(1)} ${gL.toFixed(1)}`;
  const label = valueLabel ?? `${(frac * 100).toFixed(1).replace(".", ",")}%`;

  return (
    <div className="relative mt-[14px] flex justify-center">
      <svg viewBox="0 0 200 116" width="100%" height={120} style={{ maxWidth: 230, overflow: "visible" }}>
        <path d={path} fill="none" stroke="var(--paper2)" strokeWidth={16} strokeLinecap="round" />
        <path d={path} fill="none" stroke={color} strokeWidth={16} strokeLinecap="round" strokeDasharray={dash} />
      </svg>
      <div className="absolute bottom-0 left-0 right-0 text-center">
        <div className="ofly-serif text-[34px] font-medium leading-none tracking-[-1.4px]" style={{ color }}>
          {label}
        </div>
        {caption ? <div className="mt-[3px] text-[11px] text-[var(--ink3)]">{caption}</div> : null}
      </div>
    </div>
  );
}

// ---- ColumnChart (lượng đơn theo khung giờ) -------------------------------
export interface ColumnItem {
  label: string;
  value: number;
}

interface ColumnChartProps {
  items: ColumnItem[];
  tone?: Tone;
  max?: number;
  height?: number;
  showValues?: boolean;
}

export function ColumnChart({ items, tone = "rust", max, height = 118, showValues = true }: ColumnChartProps) {
  const peak = max ?? Math.max(...items.map((i) => i.value), 1);
  const solid = toneVars(tone).solid;

  return (
    <div>
      <div className="flex items-end gap-2 border-b border-[var(--line)]" style={{ height }}>
        {items.map((it) => (
          <div key={it.label} className="flex h-full flex-1 flex-col items-center justify-end gap-[6px]">
            {showValues ? (
              <span className="ofly-num text-[10px] text-[var(--ink3)]">{VI.format(it.value)}</span>
            ) : null}
            <div
              className="w-full rounded-t-[4px]"
              style={{ height: `${Math.round((it.value / peak) * 100)}%`, minHeight: 3, background: solid, opacity: 0.82 }}
            />
          </div>
        ))}
      </div>
      {/* Nhãn trục: 10px (thay vì 11px) vì cột giờ rất hẹp, 11px sẽ chồng chữ */}
      <div className="mt-2 flex gap-2">
        {items.map((it) => (
          <span key={it.label} className="flex-1 text-center text-[10px] text-[var(--ink3)]">
            {it.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---- BarList (top chặng / hãng) -------------------------------------------
export interface BarListItem {
  label: string;
  value: ReactNode;
  pct: number;
  tone?: Tone;
  opacity?: number;
}

interface BarListProps {
  items: BarListItem[];
  tone?: Tone;
}

export function BarList({ items, tone = "rust" }: BarListProps) {
  return (
    <div>
      {items.map((it) => (
        <div key={it.label} className="mb-4 last:mb-0">
          <div className="mb-[7px] flex justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate font-medium text-[var(--ink2)]">{it.label}</span>
            <span className="ofly-num shrink-0 font-semibold text-[var(--ink)]">{it.value}</span>
          </div>
          <div className="h-[6px] overflow-hidden rounded-[4px] bg-[var(--paper2)]">
            <div
              className="h-full rounded-[4px]"
              style={{
                width: `${Math.max(0, Math.min(100, it.pct))}%`,
                background: toneVars(it.tone ?? tone).solid,
                opacity: it.opacity ?? 1,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
