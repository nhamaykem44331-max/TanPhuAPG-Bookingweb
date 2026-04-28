"use client";

import { useEffect, useState } from "react";

import { getAirlineMeta } from "@/lib/airlines";

interface AdminAirlineLogoProps {
  code?: string | null;
  airline?: string | null;
  logo?: string | null;
  size?: number;
}

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
  const color = AIRLINE_COLORS[displayCode] || "#5e7288";

  useEffect(() => {
    setImgFailed(false);
  }, [code, airline, logo, meta.logo]);

  if (meta.logo && !imgFailed) {
    return (
      <img
        src={meta.logo}
        alt={meta.name || displayCode}
        width={size}
        height={size}
        className="admin-airline-logo shrink-0 rounded-md border border-[var(--apg-border-default)] bg-white object-contain p-0.5"
        referrerPolicy="no-referrer"
        style={{ width: size, height: size }}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <span
      className="admin-airline-logo-fallback inline-flex shrink-0 items-center justify-center rounded-md text-[9px] font-black text-white"
      style={{ width: size, height: size, backgroundColor: color }}
    >
      {displayCode}
    </span>
  );
}
