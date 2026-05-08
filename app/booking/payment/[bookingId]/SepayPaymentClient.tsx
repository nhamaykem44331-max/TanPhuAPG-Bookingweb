"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface ItineraryLeg {
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
  pnrStatus: string | null;
  pnrTimelimit: string | null;
}

interface BookingInfo {
  id: string;
  orderCode: string;
  sessionId: number | null;
  status: string;
  saleAmount: number;
  currency: string;
  airline: string | null;
  routeSummary: string;
  departAt: string | null;
  returnAt: string | null;
  pnr: string | null;
  tripType: string;
  adt: number;
  chd: number;
  inf: number;
  ttlExpiresAt: string | null;
  customer: { fullName: string; phone: string | null; email: string | null } | null;
  balance: number;
  totalPaid: number;
  itinerary: ItineraryLeg[];
}

interface IntentInfo {
  id: string;
  providerOrderCode: string;
  amount: number;
  currency: string;
  status: string;
  qrCode: string | null;
  accountNumber: string | null;
  accountName: string | null;
  bankCode: string | null;
  transferContent: string;
  expiresAt: string | null;
  paidAt: string | null;
}

interface Props {
  booking: BookingInfo;
  initialIntent: IntentInfo | null;
}

interface StatusResponse {
  bookingStatus: string;
  ttlExpiresAt: string | null;
  totalPaid: number;
  balance: number;
  paymentStatus: string;
  intent: IntentInfo | null;
}

function formatVnd(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function useCountdown(expiresAt: string | null): { label: string; expired: boolean } {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!expiresAt) {
    return { label: "--:--", expired: false };
  }

  const remaining = Math.max(new Date(expiresAt).getTime() - now, 0);

  if (remaining <= 0) {
    return { label: "00:00", expired: true };
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let label: string;

  if (days > 0) {
    label = `${days}n ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  } else if (hours > 0) {
    label = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  } else {
    label = `${pad(minutes)}:${pad(seconds)}`;
  }

  return { label, expired: false };
}

export function SepayPaymentClient({ booking, initialIntent }: Props) {
  const [intent, setIntent] = useState<IntentInfo | null>(initialIntent);
  const [bookingStatus, setBookingStatus] = useState(booking.status);
  const [balance, setBalance] = useState(booking.balance);
  const [totalPaid, setTotalPaid] = useState(booking.totalPaid);
  const [paymentStatus, setPaymentStatus] = useState<string>(initialIntent?.status ?? "NONE");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const lastFetchRef = useRef(0);

  const ttl = useCountdown(intent?.expiresAt ?? booking.ttlExpiresAt);

  const isFinalPaid = paymentStatus === "PAID" || (balance <= 0 && totalPaid > 0);
  const isPartial = paymentStatus === "PARTIAL";
  const isExpired = paymentStatus === "EXPIRED" || ttl.expired;
  const isManual = paymentStatus === "MANUAL_REVIEW";

  const fetchStatus = useCallback(async () => {
    const since = Date.now() - lastFetchRef.current;
    if (since < 1500) return; // throttle
    lastFetchRef.current = Date.now();

    try {
      const res = await fetch(`/api/payment/sepay/status/${booking.id}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as StatusResponse;
      setBookingStatus(data.bookingStatus);
      setBalance(data.balance);
      setTotalPaid(data.totalPaid);
      setPaymentStatus(data.paymentStatus);
      if (data.intent) setIntent(data.intent);
    } catch (e) {
      console.warn("[sepay/status] fetch failed", e);
    }
  }, [booking.id]);

  // Polling: 4s khi PENDING, dừng khi PAID/EXPIRED
  useEffect(() => {
    if (isFinalPaid || isExpired) return;
    const id = setInterval(fetchStatus, 4000);
    return () => clearInterval(id);
  }, [fetchStatus, isFinalPaid, isExpired]);

  const createIntent = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/payment/sepay/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || "Không tạo được mã QR.");
        return;
      }
      setIntent(data.intent);
      setPaymentStatus(data.intent.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định.");
    } finally {
      setCreating(false);
    }
  }, [booking.id]);

  const copy = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* noop */
    }
  }, []);

  const departLabel = useMemo(() => {
    if (!booking.departAt) return null;
    return new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date(booking.departAt));
  }, [booking.departAt]);

  const ttlBookingLabel = useMemo(() => {
    if (!booking.ttlExpiresAt) return null;
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date(booking.ttlExpiresAt));
  }, [booking.ttlExpiresAt]);

  const paxLabel = `${booking.adt} người lớn${booking.chd > 0 ? ` · ${booking.chd} trẻ em` : ""}${
    booking.inf > 0 ? ` · ${booking.inf} em bé` : ""
  }`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white py-8 md:py-12">
      <div className="mx-auto w-full max-w-3xl px-4 md:px-6">
        <header className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Thanh toán SePay</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">
            {isFinalPaid ? "Thanh toán thành công" : "Quét mã QR để thanh toán"}
          </h1>
        </header>

        {/* Booking summary — chi tiết hành trình */}
        <section className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Header với tổng tiền */}
          <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">Hành trình</span>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {booking.tripType === "ROUNDTRIP" ? "Khứ hồi" : "Một chiều"}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                bookingStatus === "TICKETED"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : bookingStatus === "HELD"
                  ? "border-amber-300 bg-amber-50 text-amber-700"
                  : "border-slate-300 bg-slate-50 text-slate-700"
              }`}>
                {bookingStatus}
              </span>
            </div>
            <div className="rounded-lg bg-emerald-50 px-4 py-2 text-right">
              <p className="text-[10px] uppercase tracking-wide text-emerald-700">Số tiền cần thanh toán</p>
              <p className="text-2xl font-bold text-emerald-700">
                {formatVnd(intent?.amount ?? balance)} ₫
              </p>
            </div>
          </div>

          {/* Booking + Customer info */}
          <div className="grid gap-3 border-b border-slate-100 px-5 py-4 text-sm md:grid-cols-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">Mã đơn hàng</span>
                <span className="font-mono text-sm font-bold tracking-wider text-slate-900">
                  {booking.orderCode}
                </span>
              </div>
              {booking.sessionId ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">Phiên booking</span>
                  <span className="font-mono text-xs text-slate-600">{booking.sessionId}</span>
                </div>
              ) : null}
              {booking.pnr ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">PNR chính</span>
                  <span className="font-mono text-sm font-bold tracking-wider text-emerald-700">
                    {booking.pnr}
                  </span>
                </div>
              ) : null}
            </div>
            <div className="space-y-1">
              {booking.customer?.fullName ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">Hành khách</span>
                  <span className="font-semibold text-slate-900">{booking.customer.fullName}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">Số khách</span>
                <span className="text-xs text-slate-700">{paxLabel}</span>
              </div>
              {booking.customer?.phone ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">Điện thoại</span>
                  <a className="font-mono text-xs text-emerald-700 hover:underline" href={`tel:${booking.customer.phone}`}>
                    {booking.customer.phone}
                  </a>
                </div>
              ) : null}
            </div>
          </div>

          {/* Itinerary legs */}
          <div className="divide-y divide-slate-100">
            {booking.itinerary.length > 0 ? (
              booking.itinerary.map((leg) => <FlightLegRow key={leg.legKey} leg={leg} />)
            ) : (
              <div className="px-5 py-4 text-sm text-slate-500">
                <span className="font-semibold text-slate-700">{booking.routeSummary}</span>
                {departLabel ? <span className="ml-2">· {departLabel}</span> : null}
              </div>
            )}
          </div>

          {/* TTL warning */}
          {ttlBookingLabel ? (
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-amber-50/40 px-5 py-2.5 text-xs">
              <span className="flex items-center gap-1.5 text-amber-800">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" strokeLinecap="round" />
                </svg>
                Hạn giữ chỗ booking
              </span>
              <span className="font-mono font-semibold text-amber-900">{ttlBookingLabel}</span>
            </div>
          ) : null}
        </section>

        {/* QR + bank info */}
        {!intent ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 text-center shadow-sm">
            <p className="text-sm text-amber-800">Chưa có mã QR cho booking này.</p>
            <button
              type="button"
              onClick={createIntent}
              disabled={creating || balance <= 0}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? "Đang tạo..." : "Tạo mã QR thanh toán"}
            </button>
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          </section>
        ) : isFinalPaid ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="mt-3 text-lg font-bold text-emerald-800">Thanh toán đã được xác nhận</h2>
            <p className="mt-1 text-sm text-emerald-700">
              Hệ thống đã ghi nhận đủ {formatVnd(totalPaid)} ₫. Vé sẽ được xuất tự động.
            </p>
            {bookingStatus === "TICKETED" ? (
              <p className="mt-2 text-xs text-emerald-600">Booking đã chuyển sang trạng thái TICKETED.</p>
            ) : null}
          </section>
        ) : isExpired ? (
          <section className="rounded-2xl border border-red-200 bg-red-50/70 p-6 text-center shadow-sm">
            <h2 className="text-lg font-bold text-red-700">QR thanh toán đã hết hạn</h2>
            <p className="mt-2 text-sm text-red-600">
              Vui lòng liên hệ chăm sóc khách hàng hoặc tạo mã QR mới nếu booking còn hiệu lực.
            </p>
            <button
              type="button"
              onClick={createIntent}
              disabled={creating || bookingStatus === "EXPIRED" || bookingStatus === "CANCELLED"}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Tạo mã QR mới
            </button>
          </section>
        ) : (
          <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[280px_1fr]">
            {/* QR image */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
              {intent.qrCode ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={intent.qrCode}
                  alt="VietQR SePay"
                  className="h-64 w-64 rounded-md bg-white"
                />
              ) : (
                <div className="flex h-64 w-64 items-center justify-center text-xs text-slate-400">
                  Đang tạo QR...
                </div>
              )}
              <p className="mt-2 text-center text-[11px] text-slate-500">
                Quét bằng app ngân hàng để thanh toán
              </p>
            </div>

            {/* Bank details */}
            <div className="space-y-3 text-sm">
              <CopyRow
                label="Ngân hàng"
                value={intent.bankCode || ""}
                onCopy={() => copy(intent.bankCode || "", "bank")}
                copied={copied === "bank"}
              />
              <CopyRow
                label="Số tài khoản"
                value={intent.accountNumber || ""}
                onCopy={() => copy(intent.accountNumber || "", "acc")}
                copied={copied === "acc"}
                mono
              />
              {intent.accountName ? (
                <CopyRow
                  label="Chủ tài khoản"
                  value={intent.accountName}
                  onCopy={() => copy(intent.accountName || "", "name")}
                  copied={copied === "name"}
                />
              ) : null}
              <CopyRow
                label="Số tiền"
                value={`${formatVnd(intent.amount)} ₫`}
                rawCopy={String(intent.amount)}
                onCopy={() => copy(String(intent.amount), "amount")}
                copied={copied === "amount"}
                highlight
              />
              <CopyRow
                label="Nội dung CK"
                value={intent.transferContent}
                onCopy={() => copy(intent.transferContent, "content")}
                copied={copied === "content"}
                mono
                highlight
              />

              <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                <p className="font-semibold">⚠️ Lưu ý quan trọng</p>
                <p className="mt-1">
                  Vui lòng chuyển <strong>đúng số tiền</strong> và giữ <strong>nguyên nội dung</strong>{" "}
                  <span className="font-mono">{intent.transferContent}</span> để hệ thống tự động đối soát.
                </p>
              </div>

              {/* Countdown */}
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-xs text-slate-600">Thời gian còn lại</span>
                <span
                  className={`font-mono text-base font-bold tabular-nums ${
                    ttl.label === "--:--" ? "text-slate-400" : "text-emerald-700"
                  }`}
                >
                  {ttl.label}
                </span>
              </div>

              {isPartial ? (
                <div className="rounded-lg bg-orange-50 p-3 text-xs text-orange-800">
                  Đã thanh toán một phần ({formatVnd(totalPaid)} ₫). Còn thiếu{" "}
                  <strong>{formatVnd(balance)} ₫</strong>.
                </div>
              ) : null}

              {isManual ? (
                <div className="rounded-lg bg-orange-50 p-3 text-xs text-orange-800">
                  Hệ thống nhận được giao dịch nhưng cần kiểm tra thủ công. Đại lý sẽ liên hệ trong ít phút.
                </div>
              ) : null}
            </div>
          </section>
        )}

        {/* CSKH footer */}
        <footer className="mt-6 text-center text-xs text-slate-500">
          Cần hỗ trợ?{" "}
          <a className="font-semibold text-emerald-700 hover:underline" href="tel:0903456789">
            Gọi 090 345 6789
          </a>{" "}
          hoặc{" "}
          <a className="font-semibold text-emerald-700 hover:underline" href="https://zalo.me/0903456789">
            chat Zalo
          </a>
        </footer>
      </div>
    </div>
  );
}

function formatTimeOnly(iso: string | null): string {
  if (!iso) return "--:--";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(iso));
}

function formatDateOnly(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(iso));
}

function FlightLegRow({ leg }: { leg: ItineraryLeg }) {
  return (
    <div className="px-5 py-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
          {leg.legLabel}
        </span>
        {leg.airline ? (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
            {leg.airline}
            {leg.flightNumber ? ` ${leg.flightNumber}` : ""}
          </span>
        ) : null}
        {leg.cabin ? (
          <span className="text-[11px] text-slate-500">{leg.cabin}</span>
        ) : null}
        {leg.pnr ? (
          <span className="ml-auto rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold tracking-wider text-emerald-700">
            PNR · {leg.pnr}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        {/* Departure */}
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold tabular-nums text-slate-900">
            {formatTimeOnly(leg.departureAt)}
          </p>
          <p className="text-base font-semibold text-slate-700">{leg.from || "—"}</p>
          <p className="text-[11px] text-slate-500">{formatDateOnly(leg.departureAt)}</p>
        </div>

        {/* Plane separator */}
        <div className="flex flex-col items-center px-2 text-slate-400">
          <div className="h-px w-12 bg-slate-300" />
          <svg className="my-1 h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.5 19l19-7L2.5 5l0 6 13 1-13 1z" />
          </svg>
          <div className="h-px w-12 bg-slate-300" />
        </div>

        {/* Arrival */}
        <div className="min-w-0 flex-1 text-right">
          <p className="text-lg font-bold tabular-nums text-slate-900">
            {formatTimeOnly(leg.arrivalAt)}
          </p>
          <p className="text-base font-semibold text-slate-700">{leg.to || "—"}</p>
          <p className="text-[11px] text-slate-500">{formatDateOnly(leg.arrivalAt || leg.departureAt)}</p>
        </div>
      </div>

      {leg.pnrTimelimit ? (
        <p className="mt-2 text-[11px] text-amber-700">
          ⏱ Hạn giữ chỗ chặng: <span className="font-mono font-semibold">{
            new Intl.DateTimeFormat("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Ho_Chi_Minh",
            }).format(new Date(leg.pnrTimelimit))
          }</span>
        </p>
      ) : null}
    </div>
  );
}

function CopyRow({
  label,
  value,
  onCopy,
  copied,
  mono,
  highlight,
  rawCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  mono?: boolean;
  highlight?: boolean;
  rawCopy?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
        <p
          className={`truncate text-base font-semibold ${
            highlight ? "text-emerald-700" : "text-slate-900"
          } ${mono ? "font-mono" : ""}`}
        >
          {value || "—"}
        </p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
        aria-label={`Sao chép ${label}`}
        title={rawCopy ?? value}
      >
        {copied ? "Đã chép" : "Chép"}
      </button>
    </div>
  );
}
