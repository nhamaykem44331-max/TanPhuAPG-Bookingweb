import Link from "next/link";
import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

// Nút theo Manager (`ui.tsx` → Btn) — bảng §4 hợp đồng thiết kế.
// Component TRUNG TÍNH (không "use client", không hook) nên Server Component render được;
// chỉ khi cần `onClick` thì nơi gọi mới phải là Client Component.

export type BtnVariant = "primary" | "rust" | "secondary" | "ghost" | "danger";
export type BtnSize = "sm" | "md" | "lg";

const VARIANT: Record<BtnVariant, CSSProperties> = {
  primary: { background: "var(--navyMid)", color: "var(--onInk)", border: "1px solid transparent" },
  // CTA chính: gradient navy + đổ bóng nhẹ để nổi hơn primary.
  rust: {
    background: "var(--gradGreen)",
    color: "var(--onInk)",
    border: "1px solid transparent",
    boxShadow: "0 6px 16px -8px rgba(14,50,88,0.7)",
  },
  secondary: { background: "transparent", color: "var(--ink)", border: "1px solid var(--ink)" },
  ghost: { background: "transparent", color: "var(--ink2)", border: "1px solid var(--line2)" },
  danger: {
    background: "transparent",
    color: "var(--red)",
    border: "1px solid color-mix(in srgb, var(--red) 40%, transparent)",
  },
};

const PAD: Record<BtnSize, string> = { sm: "8px 15px", md: "11px 20px", lg: "14px 28px" };
const FS: Record<BtnSize, number> = { sm: 13, md: 14, lg: 15 };

function shell(variant: BtnVariant, size: BtnSize, full?: boolean): CSSProperties {
  return {
    ...VARIANT[variant],
    padding: PAD[size],
    fontSize: FS[size],
    borderRadius: 7,
    fontFamily: "var(--sans)",
    fontWeight: 600,
    letterSpacing: 0,
    display: full ? "flex" : "inline-flex",
    width: full ? "100%" : "auto",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transition: "all 0.15s",
    whiteSpace: "nowrap",
  };
}

export interface BtnProps {
  children?: ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  /** Icon lucide đặt trước nhãn. */
  icon?: ReactNode;
  /** Chiếm trọn chiều ngang. */
  full?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: MouseEventHandler<HTMLButtonElement>;
  title?: string;
  name?: string;
  value?: string;
  style?: CSSProperties;
  className?: string;
}

export function Btn({
  children,
  variant = "primary",
  size = "md",
  icon,
  full,
  disabled,
  type = "button",
  onClick,
  title,
  name,
  value,
  style,
  className,
}: BtnProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      name={name}
      value={value}
      className={className}
      style={{
        ...shell(variant, size, full),
        cursor: disabled ? "not-allowed" : "pointer",
        ...(disabled ? { opacity: 0.6 } : {}),
        ...style,
      }}
    >
      {icon}
      {children}
    </button>
  );
}

export interface ButtonLinkProps {
  href: string;
  children?: ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: ReactNode;
  full?: boolean;
  title?: string;
  target?: string;
  rel?: string;
  style?: CSSProperties;
  className?: string;
}

// Cùng dáng với Btn nhưng là điều hướng (next/link) — admin lọc/điều hướng bằng query string.
export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "md",
  icon,
  full,
  title,
  target,
  rel,
  style,
  className,
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      title={title}
      target={target}
      rel={rel}
      className={className}
      style={{ ...shell(variant, size, full), cursor: "pointer", textDecoration: "none", ...style }}
    >
      {icon}
      {children}
    </Link>
  );
}
