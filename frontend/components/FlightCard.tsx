"use client";
import React from 'react';
import { FlightResult } from '@/lib/types';
import { fmtVND, hhmm, durationText } from '@/lib/utils';

export default function FlightCard({ f, onContact }: { f: FlightResult; onContact: () => void }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
        <div className="font-semibold text-slate-700">{f.airline} {f.flightNumber}</div>
        <div>Nguồn: {f.price.source}</div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div>
          <div className="text-lg font-bold">{hhmm(f.departure.time)}</div>
          <div className="text-xs text-slate-500">{f.departure.airport} ({f.departure.airportName})</div>
        </div>
        <div className="text-center text-xs text-slate-500">
          {durationText(f.duration)} &middot; {f.stops === 0 ? 'Bay thẳng' : `${f.stops} điểm dừng`}
        </div>
        <div className="text-right">
          <div className="text-lg font-bold">{hhmm(f.arrival.time)}</div>
          <div className="text-xs text-slate-500">{f.arrival.airport} ({f.arrival.airportName})</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <div className="text-2xl font-black text-brand">{fmtVND(f.price.amount)}</div>
          <div className="text-xs text-slate-500">(&asymp; ${f.priceUSD})</div>
        </div>
        <div className="flex gap-2">
          <button className="rounded-xl border px-3 py-2 text-sm" onClick={onContact}>Liên hệ đặt vé</button>
        </div>
      </div>
    </div>
  );
}
