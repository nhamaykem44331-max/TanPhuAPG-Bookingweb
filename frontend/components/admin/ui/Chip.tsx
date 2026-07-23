import type { ReactNode } from "react";
import type { BookingStatus } from "@prisma/client";

import { statusMeta } from "@/lib/admin/ui/status";
import { toneVars, type Tone } from "@/lib/admin/ui/tones";

// Chip trạng thái theo Manager (`kit.tsx` → StatusChip): pill 100px, padding 5px 11px,
// sans 12px/600, chấm tròn 6px. Màu lấy từ biến CSS tone (`--tone-*`) nên một markup
// chạy đúng cho cả Ngày/Đêm, không cần tính lại theo theme.

interface ChipProps {
  tone: Tone;
  children: ReactNode;
  /** Chấm tròn đặc màu solid ở đầu (mặc định có). */
  dot?: boolean;
  className?: string;
}

export function Chip({ tone, children, dot = true, className }: ChipProps) {
  const t = toneVars(tone);
  return (
    <span
      className={`inline-flex items-center gap-[6px] whitespace-nowrap rounded-full border px-[11px] py-[5px] text-[12px] font-semibold leading-[1.2] tracking-[0.1px] ${className ?? ""}`}
      style={{ color: t.fg, background: t.bg, borderColor: t.bd }}
    >
      {dot ? (
        <span
          className="h-[6px] w-[6px] flex-none rounded-full"
          style={{ background: t.solid }}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </span>
  );
}

interface MiniChipProps {
  tone: Tone;
  children: ReactNode;
  className?: string;
}

export function MiniChip({ tone, children, className }: MiniChipProps) {
  const t = toneVars(tone);
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-[9px] py-[3px] text-[11px] font-semibold leading-[1.2] tracking-[0.1px] ${className ?? ""}`}
      style={{ color: t.fg, background: t.bg, borderColor: t.bd }}
    >
      {children}
    </span>
  );
}

interface StatusChipProps {
  status: BookingStatus;
  dot?: boolean;
  className?: string;
}

export function StatusChip({ status, dot = true, className }: StatusChipProps) {
  const meta = statusMeta(status);
  return (
    <Chip tone={meta.tone} dot={dot} className={className}>
      {meta.label}
    </Chip>
  );
}
