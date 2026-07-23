import type { ReactNode } from "react";

// Thẻ nền editorial theo Manager (`ui.tsx` → Card): viền 1px --line, bo 12px,
// nền --paper, KHÔNG đổ bóng ở trạng thái tĩnh.
interface PanelProps {
  children: ReactNode;
  /** Tự thêm padding 18px/20px như card thiết kế (tắt khi bọc bảng tràn viền). */
  padded?: boolean;
  /** Thẻ bấm được → nhấc nhẹ + đổ bóng khi rê chuột (Manager: Card hover). */
  hoverable?: boolean;
  className?: string;
}

// Hover làm bằng CSS thuần để Panel vẫn là component trung tính (server dùng được).
const HOVER =
  "cursor-pointer transition-[transform,box-shadow,border-color] duration-[180ms] " +
  "hover:-translate-y-[2px] hover:shadow-[0_14px_40px_-18px_rgba(26,26,25,0.28)]";

export function Panel({ children, padded = true, hoverable = false, className }: PanelProps) {
  return (
    <div
      className={`rounded-[12px] border border-[var(--line)] bg-[var(--paper)] ${
        padded ? "px-[20px] py-[18px]" : ""
      } ${hoverable ? HOVER : ""} ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

interface EyebrowProps {
  children: ReactNode;
  className?: string;
}

// Nhãn eyebrow (sans 600 · 10px · letter-spacing 2px · uppercase · --ink3).
export function Eyebrow({ children, className }: EyebrowProps) {
  return <div className={`ofly-eyebrow text-[var(--ink3)] ${className ?? ""}`}>{children}</div>;
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
