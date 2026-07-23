import type { ReactNode } from "react";

// Đầu trang theo Manager (`kit.tsx` → PageHead / SectionTitle). Trung tính (không "use client").

export interface PageHeadProps {
  /** Nhãn nhỏ phía trên tiêu đề — có gạch "—" màu accent đứng trước. */
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  /** Nút/ô KPI canh phải. */
  actions?: ReactNode;
  className?: string;
}

export function PageHead({ eyebrow, title, sub, actions, className }: PageHeadProps) {
  return (
    <div className={`mb-[26px] flex flex-wrap items-end justify-between gap-6 ${className ?? ""}`}>
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-3 text-[11px] font-semibold uppercase leading-none tracking-[2.5px] text-[var(--ink3)]">
            <span className="mr-2 text-[var(--rust)]">—</span>
            {eyebrow}
          </div>
        ) : null}
        {/* Mobile hạ cỡ tiêu đề còn 25px để không xuống dòng vỡ khối */}
        <h1 className="ofly-serif m-0 text-[25px] font-medium leading-[1.05] tracking-[-1.2px] text-[var(--ink)] sm:text-[33px]">
          {title}
        </h1>
        {sub ? (
          <p className="m-0 mt-[10px] max-w-[580px] text-[14px] leading-[1.55] text-[var(--ink3)]">{sub}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-[10px]">{actions}</div> : null}
    </div>
  );
}

export interface SectionTitleProps {
  children: ReactNode;
  className?: string;
}

export function SectionTitle({ children, className }: SectionTitleProps) {
  return (
    <h2
      className={`ofly-serif m-0 text-[21px] font-medium tracking-[-0.6px] text-[var(--ink)] ${className ?? ""}`}
    >
      {children}
    </h2>
  );
}
