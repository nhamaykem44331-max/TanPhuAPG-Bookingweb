"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { getAirlineMeta } from "@/lib/airlines";

interface AdminAirlineLogoProps {
  code?: string | null;
  airline?: string | null;
  logo?: string | null;
  size?: number;
}

// Màu thương hiệu hãng bay — đây là DỮ LIỆU nhận diện hãng, không phải token giao diện,
// nên vẫn là hex (giống bảng AIRLINES của Manager). Mọi màu nền/viền/chữ khác đều qua token.
const AIRLINE_COLORS: Record<string, string> = {
  VN: "#004b8d",
  VJ: "#e3001b",
  QH: "#00873c",
  BL: "#0050a0",
  VU: "#f5a623",
  "9G": "#ff6600",
  CZ: "#2563eb",
  MU: "#7c3aed",
  CA: "#dc2626",
  ZH: "#0ea5e9",
  "3U": "#ef4444",
};

export function AdminAirlineLogo({ code, airline, logo, size = 22 }: AdminAirlineLogoProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const meta = getAirlineMeta(code ?? undefined, airline ?? undefined, logo ?? undefined);
  const displayCode = (meta.code || code || airline || "BK").slice(0, 2).toUpperCase();
  const color = AIRLINE_COLORS[displayCode] || "var(--ink2)";

  useEffect(() => {
    setImgFailed(false);
  }, [code, airline, logo, meta.logo]);

  // Khung logo theo Manager (`ui.tsx` → AirlineLogo): bo 8px, viền --line, nền --paper, đệm 3px.
  if (meta.logo && !imgFailed) {
    return (
      <Image
        src={meta.logo}
        alt={meta.name || displayCode}
        width={size}
        height={size}
        className="admin-airline-logo shrink-0 rounded-[8px] border border-[var(--line)] bg-[var(--paper)] object-contain p-[3px]"
        unoptimized
        referrerPolicy="no-referrer"
        style={{ width: size, height: size }}
        onError={() => setImgFailed(true)}
      />
    );
  }

  // Rơi về chip chữ: nền/viền pha loãng từ màu hãng nên tự hợp cả theme Ngày lẫn Đêm.
  return (
    <span
      className="admin-airline-logo-fallback inline-flex shrink-0 items-center justify-center rounded-[8px] border font-bold tracking-[0.3px]"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.32)),
        color,
        background: `color-mix(in srgb, ${color} 12%, var(--paper))`,
        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
      }}
    >
      {displayCode}
    </span>
  );
}
