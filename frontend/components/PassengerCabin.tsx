"use client";
import { useMemo, useRef, useState, useEffect } from 'react';
import type { Cabin } from '@/lib/types';

interface PassengerValues {
  adults: number;
  children: number;
  infants: number;
  cabin: Cabin;
}

export default function PassengerCabin({
  adults, children, infants, cabin, onChange,
}: PassengerValues & { onChange: (v: PassengerValues) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const txt = useMemo(() => `${adults} NL, ${children} TE, ${infants} EB`, [adults, children, infants]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const rows: [string, number, number, number, (v: number) => void][] = [
    ['Người lớn', adults, 1, 9, (v) => onChange({ adults: v, children, infants, cabin })],
    ['Trẻ em', children, 0, 9, (v) => onChange({ adults, children: v, infants, cabin })],
    ['Em bé', infants, 0, 4, (v) => onChange({ adults, children, infants: v, cabin })],
  ];

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2" ref={ref}>
      <div className="relative">
        <button type="button" className="w-full rounded-xl border bg-white px-3 py-2 text-left" onClick={() => setOpen(!open)}>
          Hành khách: {txt}
        </button>
        {open && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border bg-white p-3 shadow">
            {rows.map(([label, val, min, max, set]) => (
              <div key={label} className="mb-2 flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <div className="flex items-center gap-2">
                  <button type="button" className="rounded border px-2" onClick={() => set(Math.max(min, val - 1))}>-</button>
                  <span>{val}</span>
                  <button type="button" className="rounded border px-2" onClick={() => set(Math.min(max, val + 1))}>+</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <select
        value={cabin}
        onChange={(e) => onChange({ adults, children, infants, cabin: e.target.value as Cabin })}
        className="rounded-xl border bg-white px-3 py-2"
      >
        <option value="economy">Phổ thông</option>
        <option value="premium">Phổ thông đặc biệt</option>
        <option value="business">Thương gia</option>
        <option value="first">Hạng nhất</option>
      </select>
    </div>
  );
}
