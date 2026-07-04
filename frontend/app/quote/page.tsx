"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import SiteGlobeHeader from "@/components/SiteGlobeHeader";
import TicketFace, { type TicketPassenger, type TicketProps } from "@/components/ticket/TicketFace";
import { bookingToTicketProps, type AirportName, type TicketSourceLeg } from "@/lib/ticket/bookingToTicketProps";
import { useTicketExport } from "@/lib/ticket/useTicketExport";
import { useAirports } from "@/lib/useAirports";
import type { FlightResult, QuotePayload } from "@/lib/types";

const QUOTE_SELECTION_KEY = "apg_quote_selection";

const CABIN_LABEL: Record<string, string> = {
  economy: "Phổ thông",
  premium: "Phổ thông đặc biệt",
  business: "Thương gia",
  first: "Hạng nhất",
};

const TITLE_OPTIONS: TicketPassenger["title"][] = ["MR", "MRS", "MS", "MSTR", "MISS"];

interface EditPax {
  title: TicketPassenger["title"];
  fullName: string;
}

function flightToSourceLeg(f: FlightResult, direction: "outbound" | "return", cabin: string): TicketSourceLeg {
  return {
    direction,
    airline: f.airlineCode || f.airline || null,
    flightNumber: f.flightNumber || null,
    from: f.departure.airport,
    to: f.arrival.airport,
    departureAt: f.departure.time,
    arrivalAt: f.arrival.time,
    cabin: CABIN_LABEL[cabin] || cabin,
    fareClass: CABIN_LABEL[cabin] || cabin,
    baggageChecked: f.namthanh?.checkedBaggageText || undefined,
  };
}

// datetime-local (yyyy-MM-ddTHH:mm) ↔ ISO
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function QuotePage() {
  const router = useRouter();
  const { airports } = useAirports();
  const [data, setData] = useState<QuotePayload | null>(null);
  const [ready, setReady] = useState(false);

  const [refCode, setRefCode] = useState("");
  const [validUntil, setValidUntil] = useState(""); // datetime-local value
  const [showPrice, setShowPrice] = useState(true);
  const [pax, setPax] = useState<EditPax[]>([]);

  const { printRef, exporting, exportError, exportPdf, exportJpg } = useTicketExport("BaoGia-TanPhuAPG");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(QUOTE_SELECTION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as QuotePayload;
        setData(parsed);
        setRefCode(parsed.quoteCode || `APG-${Date.now().toString(36).toUpperCase().slice(-6)}`);
        const validIso = parsed.searchExpiresAt || `${(parsed.search?.date || parsed.createdAt || "").slice(0, 10)}T23:59`;
        setValidUntil(isoToLocalInput(validIso) || "");
        const seeds: EditPax[] = [];
        for (let i = 0; i < (parsed.adults || 1); i += 1) seeds.push({ title: "MR", fullName: "" });
        for (let i = 0; i < (parsed.children || 0); i += 1) seeds.push({ title: "MSTR", fullName: "" });
        for (let i = 0; i < (parsed.infants || 0); i += 1) seeds.push({ title: "MSTR", fullName: "" });
        setPax(seeds.length ? seeds : [{ title: "MR", fullName: "" }]);
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const airportNames = useMemo(() => {
    const m: Record<string, AirportName> = {};
    for (const a of airports) m[a.code] = { city: a.city, name: a.name };
    return m;
  }, [airports]);

  const ticket = useMemo<TicketProps | null>(() => {
    if (!data) return null;
    const legs: TicketSourceLeg[] = [flightToSourceLeg(data.outbound, "outbound", data.cabin)];
    if (data.tripType === "roundtrip" && data.inbound) {
      legs.push(flightToSourceLeg(data.inbound, "return", data.cabin));
    }
    const outAmt = data.outbound.fareBreakdown?.totalAmount ?? data.outbound.price.amount;
    const inAmt = data.inbound?.fareBreakdown?.totalAmount ?? data.inbound?.price.amount ?? 0;
    const perPax = outAmt + inAmt;
    const base =
      (data.outbound.fareBreakdown?.baseAmount ?? outAmt) * data.adults +
      (data.inbound?.fareBreakdown?.baseAmount ?? inAmt) * data.adults;
    const tax =
      (data.outbound.fareBreakdown?.taxesFees ?? 0) * data.adults +
      (data.inbound?.fareBreakdown?.taxesFees ?? 0) * data.adults;
    const total = Math.round(perPax * data.adults);

    const base0 = bookingToTicketProps(
      {
        status: "quote",
        referenceCode: refCode || "APG",
        legs,
        passengers: [],
        total,
        baseFare: Math.round(base),
        taxesAndFees: Math.round(tax),
        quoteValidUntilIso: validUntil ? new Date(validUntil).toISOString() : null,
        showPrice,
      },
      airportNames,
    );

    const passengers: TicketPassenger[] = pax.map((p, i) => ({
      index: i + 1,
      title: p.title,
      fullName: p.fullName.trim().toUpperCase() || "—",
    }));

    return { ...base0, passengers, showPrice };
  }, [data, refCode, validUntil, showPrice, pax, airportNames]);

  if (!ready) return null;

  if (!data || !ticket) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#EEF1F4] p-6 text-center">
        <div className="rounded-2xl bg-white p-6 shadow-md">
          <div className="mb-2 text-3xl">✈️</div>
          <p className="mb-4 text-sm text-[#586675]">Chưa có chuyến bay để lập báo giá.</p>
          <button
            type="button"
            onClick={() => router.push("/dat-ve")}
            className="rounded-lg bg-[#0C2740] px-5 py-2.5 text-sm font-bold text-white"
          >
            Tìm chuyến bay
          </button>
        </div>
      </div>
    );
  }

  const hasExtraPax = (data.children || 0) > 0 || (data.infants || 0) > 0;

  return (
    <div className="min-h-screen bg-[#EEF1F4]">
      <SiteGlobeHeader />
      <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Editor */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl border border-[#E1E4E8] bg-white p-4 shadow-sm">
            <h1 className="text-[17px] font-semibold text-[#0C2740]">Lập báo giá</h1>
            <p className="mt-0.5 text-[12px] text-[#586675]">Chỉnh sửa rồi tải PDF/ảnh gửi khách.</p>

            <label className="mt-4 block text-[11px] font-semibold text-[#586675]">
              Mã tham chiếu
              <input
                value={refCode}
                onChange={(e) => setRefCode(e.target.value.toUpperCase())}
                className="mt-1 h-10 w-full rounded-lg border border-[#D6D3CA] px-3 font-mono text-sm uppercase outline-none focus:border-[#0C2740]"
              />
            </label>

            <label className="mt-3 block text-[11px] font-semibold text-[#586675]">
              Giá có hiệu lực đến
              <input
                type="datetime-local"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D6D3CA] px-3 text-sm outline-none focus:border-[#0C2740]"
              />
            </label>

            <label className="mt-3 flex items-center gap-2 text-[13px] font-medium text-[#16212B]">
              <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} className="h-4 w-4 accent-[#0C2740]" />
              Hiện giá vé trên mặt báo giá
            </label>
          </div>

          <div className="rounded-2xl border border-[#E1E4E8] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[#0C2740]">Hành khách</span>
              <button
                type="button"
                onClick={() => setPax((v) => [...v, { title: "MR", fullName: "" }])}
                className="rounded-md border border-[#CBD8E4] px-2 py-1 text-[11px] font-semibold text-[#143A5C] hover:bg-[#F2F6FA]"
              >
                + Thêm
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {pax.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={p.title}
                    onChange={(e) => setPax((v) => v.map((x, idx) => (idx === i ? { ...x, title: e.target.value as TicketPassenger["title"] } : x)))}
                    className="h-9 rounded-lg border border-[#D6D3CA] px-1.5 text-[12px] outline-none focus:border-[#0C2740]"
                  >
                    {TITLE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input
                    value={p.fullName}
                    onChange={(e) => setPax((v) => v.map((x, idx) => (idx === i ? { ...x, fullName: e.target.value } : x)))}
                    placeholder="NGUYEN VAN AN"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-[#D6D3CA] px-2.5 text-[12px] uppercase outline-none focus:border-[#0C2740]"
                  />
                  {pax.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPax((v) => v.filter((_, idx) => idx !== i))}
                      aria-label="Xóa hành khách"
                      className="grid h-9 w-8 shrink-0 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            {hasExtraPax && (
              <p className="mt-2 text-[11px] text-amber-700">Giá trẻ em/em bé báo riêng khi giữ chỗ — giá trên mặt vé là phần người lớn.</p>
            )}
          </div>

          <div className="rounded-2xl border border-[#E1E4E8] bg-white p-4 shadow-sm">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={exportPdf}
                disabled={exporting !== null}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-bold text-white shadow-sm disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#0C2740,#143A5C,#1A4E78)" }}
              >
                {exporting === "pdf" ? "Đang tạo…" : "Tải PDF"}
              </button>
              <button
                type="button"
                onClick={exportJpg}
                disabled={exporting !== null}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-[#C9C9C9] bg-white text-sm font-bold text-[#0C2740] disabled:opacity-60"
              >
                {exporting === "jpg" ? "Đang tạo…" : "Tải ảnh"}
              </button>
            </div>
            {exportError ? <p className="mt-2 text-[12px] text-red-600">{exportError}</p> : null}
            <button
              type="button"
              onClick={() => router.push("/dat-cho")}
              className="mt-2 h-10 w-full rounded-lg border border-[#CBD8E4] bg-white text-[13px] font-semibold text-[#143A5C] hover:bg-[#F2F6FA]"
            >
              Tiếp tục giữ chỗ →
            </button>
          </div>
        </aside>

        {/* Live preview */}
        <main className="min-w-0">
          <div ref={printRef}>
            <TicketFace {...ticket} />
          </div>
        </main>
      </div>
    </div>
  );
}
