import type { ReactNode } from "react";

// HANDOFF I.4 — thẻ nền editorial: viền 1px, bo 10px, nền surface, không đổ bóng.
interface PanelProps {
  children: ReactNode;
  /** Tự thêm padding 22px/26px như card thiết kế (tắt khi bọc bảng tràn viền). */
  padded?: boolean;
  className?: string;
}

export function Panel({ children, padded = true, className }: PanelProps) {
  return (
    <div
      className={`rounded-[10px] border border-[var(--line)] bg-[var(--surface)] ${
        padded ? "px-[26px] py-[22px]" : ""
      } ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

interface EyebrowProps {
  children: ReactNode;
  className?: string;
}

// Nhãn eyebrow (Inter 600 · 10px · letter-spacing 2px · uppercase · ink-faint).
export function Eyebrow({ children, className }: EyebrowProps) {
  return <div className={`ofly-eyebrow ${className ?? ""}`}>{children}</div>;
}

interface PanelHeadingProps {
  eyebrow: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function PanelHeading({ eyebrow, action, className }: PanelHeadingProps) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className ?? ""}`}>
      <Eyebrow>{eyebrow}</Eyebrow>
      {action}
    </div>
  );
}
