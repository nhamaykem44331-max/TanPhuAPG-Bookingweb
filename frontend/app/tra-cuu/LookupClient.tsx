"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import SiteGlobeHeader from "@/components/SiteGlobeHeader";
import DownloadableTicket from "@/components/ticket/DownloadableTicket";
import {
  bookingToTicketProps,
  type AirportName,
  type TicketSource,
  type TicketSourceLeg,
} from "@/lib/ticket/bookingToTicketProps";
import { useAirports } from "@/lib/useAirports";

interface LookupItineraryLeg {
  legKey: string;
  legLabel: string;
  airline: string | null;
  flightNumber: string | null;
  route: string;
  from: string | null;
  to: string | null;
  departureAt: string | null;
  arrivalAt: string | null;
  cabin: string | null;
  pnr: string | null;
}

interface LookupResult {
  bookingId: string;
  paymentUrl: string;
  orderCode: string;
  bookingStatus: string;
  tripType: string;
  routeSummary: string;
  saleAmount: number;
  currency: string;
  totalPaid: number;
  balance: number;
  ttlExpiresAt: string | null;
  paidAtIso: string | null;
  pnr: string | null;
  customerName: string | null;
  itinerary: LookupItineraryLeg[];
  passengers: { type: string; firstName: string; lastName: string; title?: string; dob?: string }[];
  intent: {
    amount: number;
    bankCode: string | null;
    accountNumber: string | null;
    accountName: string | null;
    transferContent: string | null;
    qrCode: string | null;
  } | null;
}

const PAID_STATUSES = new Set(["PAID", "TICKETING", "TICKETED"]);
const HOLD_STATUSES = new Set(["HELD", "PENDING_PAYMENT"]);

function formatVnd(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatDeadline(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(iso));
}

function toTicketLegs(itinerary: LookupItineraryLeg[]): TicketSourceLeg[] {
  return itinerary.map((l) => ({
    direction: l.legKey === "inbound" || l.legLabel.includes("về") ? "return" : "outbound",
    airline: l.airline,
    flightNumber: l.flightNumber,
    from: l.from,
    to: l.to,
    departureAt: l.departureAt,
    arrivalAt: l.arrivalAt,
    cabin: l.cabin,
  }));
}

export default function LookupClient() {
  const [orderCode, setOrderCode] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);

  const { airports } = useAirports();
  const airportNames = useMemo(() => {
    const m: Record<string, AirportName> = {};
    for (const a of airports) m[a.code] = { city: a.city, name: a.name };
    return m;
  }, [airports]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/booking/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderCode, phone }),
      });
      if (res.status === 429) {
        setError("Bạn đã thử quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.");
        return;
      }
      if (!res.ok) {
        setError("Không tìm thấy đơn khớp mã đơn và số điện thoại. Vui lòng kiểm tra lại.");
        return;
      }
      setResult((await res.json()) as LookupResult);
    } catch {
      setError("Có lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(to bottom,#EAF0F6,#F4F2EC 42%)" }}>
      <SiteGlobeHeader />
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-[26px] font-semibold text-[#0B1E16]" style={{ fontFamily: "var(--font-serif), Georgia, serif" }}>
          Chuyến bay của tôi
        </h1>
        <p className="mt-1 text-sm text-[#586675]">
          Nhập mã đơn và số điện thoại đã dùng khi đặt để xem trạng thái, tải mặt vé và thanh toán tiếp.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 rounded-2xl border border-[#E5E2D9] bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[#586675]">Mã đơn hàng</span>
              <input
                value={orderCode}
                onChange={(e) => setOrderCode(e.target.value)}
                placeholder="APGVKA91"
                autoCapitalize="characters"
                className="h-11 w-full rounded-lg border border-[#D6D3CA] px-3 font-mono text-sm uppercase tracking-wide outline-none focus:border-[#143A5C]"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[#586675]">Số điện thoại</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09xx xxx xxx"
                inputMode="tel"
                className="h-11 w-full rounded-lg border border-[#D6D3CA] px-3 text-sm outline-none focus:border-[#143A5C]"
                required
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold text-white shadow-sm transition disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#0C2740,#143A5C,#1A4E78)" }}
            >
              {loading ? "Đang tra…" : "Tra cứu"}
            </button>
          </div>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </form>

        {result ? <ResultView result={result} airportNames={airportNames} /> : null}
      </div>
    </div>
  );
}

function ResultView({ result, airportNames }: { result: LookupResult; airportNames: Record<string, AirportName> }) {
  const isPaid = PAID_STATUSES.has(result.bookingStatus);
  const isHold = HOLD_STATUSES.has(result.bookingStatus);

  if (!isPaid && !isHold) {
    return (
      <section className="mt-5 rounded-2xl border border-[#E5E2D9] bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-[#586675]">
          Đơn <span className="font-mono text-[#16212B]">{result.orderCode}</span> hiện ở trạng thái{" "}
          <b>{result.bookingStatus === "EXPIRED" ? "đã hết hạn giữ chỗ" : "không còn hiệu lực"}</b>.
        </p>
        <Link
          href="/dat-ve"
          className="mt-4 inline-flex h-11 items-center justify-center rounded-lg px-6 text-sm font-bold text-white shadow-sm"
          style={{ background: "linear-gradient(135deg,#0C2740,#143A5C,#1A4E78)" }}
        >
          Đặt lại vé
        </Link>
      </section>
    );
  }

  const legs = toTicketLegs(result.itinerary);

  let source: TicketSource;
  let canDownload = true;

  if (isPaid) {
    source = {
      status: "paid",
      referenceCode: result.pnr || result.orderCode,
      legs,
      passengers: result.passengers,
      total: result.saleAmount,
      paid: { totalPaid: result.totalPaid || result.saleAmount, paidAtIso: result.paidAtIso },
    };
  } else {
    const staticQr =
      result.intent?.bankCode && result.intent?.accountNumber
        ? `https://img.vietqr.io/image/${result.intent.bankCode}-${result.intent.accountNumber}-compact2.png?amount=${result.balance}&addInfo=${encodeURIComponent(result.intent.transferContent || `APG${result.orderCode}`)}`
        : "";
    canDownload = Boolean(staticQr);
    source = {
      status: "hold",
      referenceCode: result.pnr || result.orderCode,
      legs,
      passengers: result.passengers,
      total: result.saleAmount,
      hold: {
        amountDue: result.balance || result.saleAmount,
        bankCode: result.intent?.bankCode ?? null,
        bankAccount: result.intent?.accountNumber ?? null,
        bankAccountName: result.intent?.accountName ?? undefined,
        transferContent: result.intent?.transferContent || `APG${result.orderCode}`,
        qrImageUrl: staticQr,
        deadlineIso: result.ttlExpiresAt,
      },
    };
  }

  const ticket = bookingToTicketProps(source, airportNames);

  return (
    <section className="mt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E5E2D9] bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
              isPaid ? "border-[#A7E8C7] bg-[#EBFBF2] text-[#1F7A54]" : "border-amber-300 bg-amber-50 text-amber-700"
            }`}
          >
            {isPaid ? (result.bookingStatus === "TICKETED" ? "Đã xuất vé" : "Đã thanh toán") : "Đang giữ chỗ"}
          </span>
          <span className="text-sm text-[#586675]">
            {result.routeSummary} · <span className="font-mono text-[#16212B]">{result.orderCode}</span>
          </span>
        </div>
        {isHold ? (
          <span className="text-xs font-semibold text-amber-800">
            Hạn giữ chỗ: <span className="font-mono">{formatDeadline(result.ttlExpiresAt)}</span>
          </span>
        ) : null}
      </div>

      {canDownload ? (
        <DownloadableTicket ticket={ticket} fileBaseName={`${isPaid ? "Ve" : "GiuCho"}-${result.orderCode}`} />
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-sm text-amber-800">
          Đơn đang được giữ chỗ. Bấm “Thanh toán tiếp” để lấy mã QR và tải mặt vé.
        </div>
      )}

      {isHold ? (
        <div className="mt-4 flex justify-center">
          <Link
            href={result.paymentUrl}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-6 text-sm font-bold text-white shadow-sm"
            style={{ background: "linear-gradient(135deg,#1f5f44,#248a3d)" }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            Thanh toán tiếp
          </Link>
        </div>
      ) : null}
    </section>
  );
}
