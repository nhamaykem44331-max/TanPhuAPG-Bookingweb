import Link from "next/link";
import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

// Tab lọc theo Manager (`kit.tsx` → FilterTab / TabPills). Trung tính (không "use client")
// vì các màn admin lọc bằng query string → thường render dạng <Link>, không cần state client.
// Chữ trắng #FFFFFF là ngoại lệ hợp lệ: nằm trên khối navy đặc.

const ON_NAVY = "#FFFFFF";

function tabStyle(active?: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    height: 40,
    padding: "8px 14px",
    borderRadius: 9,
    border: `1px solid ${active ? "var(--navyMid)" : "var(--line2)"}`,
    background: active ? "var(--navyMid)" : "transparent",
    color: active ? ON_NAVY : "var(--ink2)",
    fontFamily: "var(--sans)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
    textDecoration: "none",
    transition: "all 0.15s",
  };
}

function CountBadge({ count, active }: { count: ReactNode; active?: boolean }) {
  return (
    <span
      className="ofly-num"
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "1px 6px",
        borderRadius: 100,
        background: active ? "rgba(255,255,255,0.18)" : "var(--paper3)",
        color: active ? ON_NAVY : "var(--ink3)",
      }}
    >
      {count}
    </span>
  );
}

export interface FilterTabProps {
  children: ReactNode;
  active?: boolean;
  count?: ReactNode;
  /** Có href → render <Link> (lọc bằng query string); không có → <button>. */
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  style?: CSSProperties;
}

export function FilterTab({ children, active, count, href, onClick, className, style }: FilterTabProps) {
  const inner = (
    <>
      {children}
      {count != null ? <CountBadge count={count} active={active} /> : null}
    </>
  );
  const css = { ...tabStyle(active), ...style };

  if (href) {
    return (
      <Link href={href} className={className} style={css} aria-current={active ? "page" : undefined}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} style={css} aria-pressed={active}>
      {inner}
    </button>
  );
}

export interface TabPillOption {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
  count?: ReactNode;
  /** Có href → pill này là <Link>. */
  href?: string;
}

export interface TabPillsProps {
  value: string;
  options: TabPillOption[];
  onChange?: (value: string) => void;
  className?: string;
}

export function TabPills({ value, options, onChange, className }: TabPillsProps) {
  return (
    <div
      className={`inline-flex gap-1 rounded-[10px] border border-[var(--line2)] bg-[var(--paper2)] p-1 ${className ?? ""}`}
    >
      {options.map((o) => {
        const on = value === o.value;
        const css: CSSProperties = {
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "8px 16px",
          borderRadius: 7,
          border: "none",
          background: on ? "var(--navyMid)" : "transparent",
          color: on ? ON_NAVY : "var(--ink3)",
          fontFamily: "var(--sans)",
          fontSize: 13,
          fontWeight: on ? 600 : 500,
          cursor: "pointer",
          whiteSpace: "nowrap",
          textDecoration: "none",
          transition: "all 0.13s",
        };
        const inner = (
          <>
            {o.icon}
            {o.label}
            {o.count != null ? <CountBadge count={o.count} active={on} /> : null}
          </>
        );

        if (o.href) {
          return (
            <Link key={o.value} href={o.href} style={css} aria-current={on ? "page" : undefined}>
              {inner}
            </Link>
          );
        }
        return (
          <button key={o.value} type="button" onClick={() => onChange?.(o.value)} style={css} aria-pressed={on}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}
