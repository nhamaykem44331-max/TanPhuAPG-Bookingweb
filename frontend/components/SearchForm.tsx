"use client";

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AirportInput from '@/components/AirportInput';
import PassengerCabin from '@/components/PassengerCabin';
import type { AirportSelection, Cabin } from '@/lib/types';
import { buildAirportSelection, useAirports } from '@/lib/useAirports';

const QUICK_ROUTE_CODES: Array<[string, string]> = [
  ['HAN', 'SGN'],
  ['HAN', 'DAD'],
  ['SGN', 'HAN'],
  ['HAN', 'PQC'],
];

const DEFAULT_FROM: AirportSelection = { code: 'HAN', label: 'Hà Nội (HAN) - Nội Bài' };
const DEFAULT_TO: AirportSelection = { code: 'SGN', label: 'TP.HCM (SGN) - Tân Sơn Nhất' };

export default function SearchForm() {
  const router = useRouter();
  const { airports } = useAirports();
  const [tripType, setTripType] = useState<'oneway' | 'roundtrip'>('oneway');
  const [fromSel, setFromSel] = useState<AirportSelection | null>(DEFAULT_FROM);
  const [toSel, setToSel] = useState<AirportSelection | null>(DEFAULT_TO);
  const d = new Date();
  d.setDate(d.getDate() + 7);
  const [date, setDate] = useState(d.toISOString().slice(0, 10));
  const [returnDate, setReturnDate] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [cabin, setCabin] = useState<Cabin>('economy');

  const quickRoutes = useMemo(() => QUICK_ROUTE_CODES.map(([from, to]) => ({
    from: buildAirportSelection(airports, from, from) || { code: from, label: from },
    to: buildAirportSelection(airports, to, to) || { code: to, label: to },
  })), [airports]);

  const submit = () => {
    if (!fromSel?.code || !toSel?.code) return;
    const q = new URLSearchParams({
      from: fromSel.code,
      to: toSel.code,
      date,
      adults: String(adults),
      children: String(children),
      infants: String(infants),
      cabin,
      tripType,
    });
    if (tripType === 'roundtrip' && returnDate) q.set('returnDate', returnDate);
    router.push(`/search?${q.toString()}`);
  };

  return (
    <div className="rounded-3xl bg-white p-6 shadow-lg">
      <div className="mb-4 flex gap-2">
        <button className={`rounded-full px-4 py-2 ${tripType === 'oneway' ? 'bg-brand text-white' : 'border'}`} onClick={() => setTripType('oneway')}>Một chiều</button>
        <button className={`rounded-full px-4 py-2 ${tripType === 'roundtrip' ? 'bg-brand text-white' : 'border'}`} onClick={() => setTripType('roundtrip')}>Khứ hồi</button>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <AirportInput label="Điểm đi" value={fromSel} onSelect={setFromSel} placeholder="Hà Nội, HAN..." />
        <div className="flex items-end justify-center pb-2">
          <button
            className="rounded-full border px-3 py-1"
            onClick={() => {
              const currentFrom = fromSel;
              setFromSel(toSel);
              setToSel(currentFrom);
            }}
          >
            ⇄
          </button>
        </div>
        <AirportInput label="Điểm đến" value={toSel} onSelect={setToSel} placeholder="TP.HCM, SGN..." />
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Ngày đi</label>
          <input type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border px-3 py-2" />
        </div>
        {tripType === 'roundtrip' && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Ngày về</label>
            <input type="date" min={date} value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="w-full rounded-xl border px-3 py-2" />
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
        <PassengerCabin adults={adults} children={children} infants={infants} cabin={cabin} onChange={(v) => { setAdults(v.adults); setChildren(v.children); setInfants(v.infants); setCabin(v.cabin); }} />
        <button className="rounded-xl bg-brand px-5 py-2 font-semibold text-white" onClick={submit}>TÌM CHUYẾN BAY</button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {quickRoutes.map((route) => (
          <button
            key={`${route.from.code}-${route.to.code}`}
            className="rounded-full border bg-slate-50 px-3 py-1 text-sm"
            onClick={() => {
              setFromSel(route.from);
              setToSel(route.to);
            }}
          >
            {route.from.code}-{route.to.code}
          </button>
        ))}
      </div>
    </div>
  );
}
