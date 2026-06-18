import type { ReactNode } from "react";
import type { BookingStatus } from "@prisma/client";

import { statusMeta } from "@/lib/admin/ui/status";
import { toneVars, type Tone } from "@/lib/admin/ui/tones";

// HANDOFF I.2 — chip/miniChip parity với file thiết kế. Màu lấy từ biến CSS tone
// (`--tone-*`) nên một markup chạy đúng cho cả Ngày/Đêm, không cần tính lại theo theme.

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
      className={`inline-flex items-center gap-[7px] whitespace-nowrap rounded-full border px-[10px] py-1 text-[11px] font-semibold leading-[1.3] ${className ?? ""}`}
      style={{ color: t.fg, background: t.bg, borderColor: t.bd }}
    >
      {dot ? (
        <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: t.solid }} aria-hidden="true" />
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
      className={`inline-flex whitespace-nowrap rounded-full border px-[9px] py-[3px] text-[10px] font-semibold leading-[1.3] tracking-[0.3px] ${className ?? ""}`}
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
