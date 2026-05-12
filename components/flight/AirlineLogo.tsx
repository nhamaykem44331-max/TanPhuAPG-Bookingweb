"use client";

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { getAirlineMeta } from '@/lib/airlines';

export function airlineColor(code: string) {
  const map: Record<string, string> = {
    VN: '#004b8d',
    VJ: '#e3001b',
    QH: '#00873c',
    BL: '#0050a0',
    VU: '#f5a623',
    '9G': '#ff6600',
    CZ: '#2563eb',
    MU: '#7c3aed',
    CA: '#dc2626',
    ZH: '#0ea5e9',
    '3U': '#ef4444',
  };
  return map[code] ?? '#5e7288';
}

export default function AirlineLogo({
  code,
  airline,
  logo,
  size = 32,
}: {
  code?: string;
  airline?: string;
  logo?: string;
  size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => setImgFailed(false), [code, airline, logo]);

  const meta = getAirlineMeta(code, airline, logo);
  const displayCode = (meta.code || code || '').slice(0, 2).toUpperCase();
  const bg = airlineColor(displayCode) || airlineColor(String(code || '').toUpperCase());

  if (meta.logo && !imgFailed) {
    return (
      <Image
        alt={displayCode || ''}
        className="shrink-0 rounded-lg border border-slate-100 bg-white object-contain p-0.5 shadow-sm"
        height={size}
        onError={() => setImgFailed(true)}
        priority={false}
        referrerPolicy="no-referrer"
        src={meta.logo}
        unoptimized
        width={size}
      />
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg text-[9px] font-black text-white"
      style={{ width: size, height: size, backgroundColor: bg }}
    >
      {displayCode || 'AP'}
    </div>
  );
}
