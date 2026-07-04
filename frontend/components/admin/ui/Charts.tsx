import type { ReactNode } from "react";

import { toneVars, type Tone } from "@/lib/admin/ui/tones";

// HANDOFF J.2 — biểu đồ SVG phẳng (không gradient/đổ bóng), màu qua biến CSS tone.
// Toàn bộ hình học sao chép từ file thiết kế (spark/chart14/donut/gauge/cột/BarList).

const VI = new Intl.NumberFormat("vi-VN");

// ---- Sparkline 78×26 (KPI card) -------------------------------------------
interface SparklineProps {
  values: number[];
  tone?: Tone;
  width?: number;
  height?: number;
}

export function Sparkline({ values, tone = "rust", width = 78, height = 26 }: SparklineProps) {
  if (values.length === 0) return null;
  const accent = toneVars(tone).solid;
  const p = 3;
  const mx = Math.max(...values);
  const mn = Math.min(...values);
  const rng = mx - mn || 1;
  const st = values.length > 1 ? (width - p * 2) / (values.length - 1) : 0;
  const pts = values.map(
    (v, i) =>
      [
        Number((p + i * st).toFixed(1)),
        Number((height - p - ((v - mn) / rng) * (height - p * 2)).toFixed(1)),
      ] as const,
  );
  const d = "M" + pts.map((q) => q.join(" ")).join(" L");
  const last = pts[pts.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      fill="none"
      aria-hidden="true"
      style={{ flex: "none", overflow: "visible" }}
    >
      <path
        d={d}
        fill="none"
        stroke={accent}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r={2.6} fill={accent} />
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
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" width="100%" height={height + 2} style={{ display: "block" }}>
        <path d={area} fill={accent} fillOpacity={0.07} />
        <line
          x1={pL}
          y1={avgY}
          x2={w - pR}
          y2={avgY}
          stroke="var(--ink-faint)"
          strokeWidth={1}
          strokeDasharray="5 5"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={line}
          fill="none"
          stroke={accent}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={last.x} cy={last.y} r={4.5} fill={accent} stroke="var(--surface)" strokeWidth={2.5} />
      </svg>
      {labels && labels.length > 0 ? (
        <div className="mt-2 flex justify-between text-[11px] text-[var(--ink-faint)]">
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
    <div className="flex items-center gap-[22px]">
      <div className="relative flex-none" style={{ width: size, height: size }}>
        <svg viewBox="0 0 140 140" width={size} height={size}>
          <circle cx={70} cy={70} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={18} />
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
          <span className="ofly-serif text-[30px] font-medium leading-none">{VI.format(total)}</span>
          <span className="text-[10px] tracking-[1px] text-[var(--ink-soft)]">{caption}</span>
        </div>
      </div>

      {legend ? (
        <div className="flex flex-1 flex-col gap-[9px]">
          {segs.map((s) => (
            <div key={s.label} className="flex items-center gap-[9px]">
              <span className="h-[9px] w-[9px] flex-none rounded-[3px]" style={{ background: s.solid }} />
              <span className="flex-1 whitespace-nowrap text-[12px] text-[var(--ink-soft)]">{s.label}</span>
              <span className="ofly-serif text-[13px] font-medium">{VI.format(s.value)}</span>
              <span className="w-[34px] text-right text-[11px] text-[var(--ink-faint)]">{s.pct}%</span>
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
        <path d={path} fill="none" stroke="var(--surface-2)" strokeWidth={16} strokeLinecap="round" />
        <path d={path} fill="none" stroke={color} strokeWidth={16} strokeLinecap="round" strokeDasharray={dash} />
      </svg>
      <div className="absolute bottom-0 left-0 right-0 text-center">
        <div className="ofly-serif text-[34px] font-medium leading-none" style={{ color }}>
          {label}
        </div>
        {caption ? <div className="mt-[3px] text-[11px] text-[var(--ink-soft)]">{caption}</div> : null}
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
      <div className="flex items-end gap-2" style={{ height }}>
        {items.map((it) => (
          <div key={it.label} className="flex h-full flex-1 flex-col items-center justify-end gap-[6px]">
            {showValues ? <span className="text-[10px] text-[var(--ink-soft)]">{VI.format(it.value)}</span> : null}
            <div
              className="w-full rounded-t-[4px]"
              style={{ height: `${Math.round((it.value / peak) * 100)}%`, minHeight: 3, background: solid, opacity: 0.82 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {items.map((it) => (
          <span key={it.label} className="flex-1 text-center text-[9px] text-[var(--ink-faint)]">
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
          <div className="mb-[7px] flex justify-between text-[13px]">
            <span className="font-medium">{it.label}</span>
            <span className="ofly-serif font-medium">{it.value}</span>
          </div>
          <div className="h-[6px] overflow-hidden rounded-[4px] bg-[var(--surface-2)]">
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
