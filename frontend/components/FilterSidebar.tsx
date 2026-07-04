"use client";
import React from 'react';
import { FlightResult } from '@/lib/types';
import { fmtVND } from '@/lib/utils';

export default function FilterSidebar({
  flights, stopFilter, setStopFilter, airlineFilter, setAirlineFilter,
}: {
  flights: FlightResult[];
  stopFilter: Set<string>; setStopFilter: (v: Set<string>) => void;
  airlineFilter: Set<string>; setAirlineFilter: (v: Set<string>) => void;
}) {
  const stopCounts = {
    nonstop: flights.filter((f) => f.stops === 0).length,
    one: flights.filter((f) => f.stops === 1).length,
    two: flights.filter((f) => f.stops >= 2).length,
  };

  const airlines = Array.from(new Set(flights.map((f) => f.airline))).map((a) => ({
    name: a,
    minPrice: Math.min(...flights.filter((f) => f.airline === a).map((f) => f.price.amount)),
  }));

  const toggle = (set: Set<string>, key: string, update: (s: Set<string>) => void) => {
    const n = new Set(set);
    if (n.has(key)) n.delete(key); else n.add(key);
    update(n);
  };

  return (
    <div className="space-y-4 rounded-2xl border bg-white p-4">
      <div>
        <div className="mb-2 font-semibold">Số điểm dừng</div>
        <label className="block"><input type="checkbox" checked={stopFilter.has('nonstop')} onChange={() => toggle(stopFilter, 'nonstop', setStopFilter)} /> Bay thẳng ({stopCounts.nonstop})</label>
        <label className="block"><input type="checkbox" checked={stopFilter.has('one')} onChange={() => toggle(stopFilter, 'one', setStopFilter)} /> 1 điểm dừng ({stopCounts.one})</label>
        <label className="block"><input type="checkbox" checked={stopFilter.has('two')} onChange={() => toggle(stopFilter, 'two', setStopFilter)} /> 2+ điểm dừng ({stopCounts.two})</label>
      </div>

      <div>
        <div className="mb-2 font-semibold">Hãng bay</div>
        <div className="mb-2 text-xs">
          <button className="underline" onClick={() => setAirlineFilter(new Set(airlines.map((a) => a.name)))}>Chọn tất cả</button>{' / '}
          <button className="underline" onClick={() => setAirlineFilter(new Set())}>Bỏ chọn</button>
        </div>
        {airlines.map((a) => (
          <label key={a.name} className="block">
            <input type="checkbox" checked={airlineFilter.has(a.name)} onChange={() => toggle(airlineFilter, a.name, setAirlineFilter)} />{' '}
            {a.name} — từ {fmtVND(a.minPrice)}
          </label>
        ))}
      </div>
    </div>
  );
}
