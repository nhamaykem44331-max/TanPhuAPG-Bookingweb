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
  const autoCreateAttemptedRef = useRef(false);

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

  useEffect(() => {
    if (
      autoCreateAttemptedRef.current ||
      intent ||
      balance <= 0 ||
      isExpired ||
      bookingStatus === "EXPIRED" ||
      bookingStatus === "CANCELLED"
    ) {
      return;
    }

    autoCreateAttemptedRef.current = true;
    void createIntent();
  }, [balance, bookingStatus, createIntent, intent, isExpired]);

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
  const payableAmount = intent?.amount ?? balance;

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-emerald-50 via-white to-white py-4 md:py-8">
      <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 lg:px-6">
        <header className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end lg:mb-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Thanh toán SePay</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight text-slate-950 md:text-3xl">
              {isFinalPaid ? "Thanh toán thành công" : "Quét mã QR để thanh toán"}
            </h1>
            <p className="mt-1 text-xs text-slate-500 md:text-sm">
              Mã đơn <span className="font-mono font-semibold text-slate-800">{booking.orderCode}</span>
              {booking.pnr ? <> · PNR <span className="font-mono font-semibold text-emerald-700">{booking.pnr}</span></> : null}
            </p>
          </div>
          <div className="rounded-xl bg-emerald-700 px-4 py-3 text-white shadow-sm sm:min-w-[220px] sm:text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-100">Cần thanh toán</p>
            <p className="text-2xl font-black tabular-nums md:text-3xl">{formatVnd(payableAmount)} ₫</p>
          </div>
        </header>

        <main className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-start">
          <div className="order-2 min-w-0 lg:order-1">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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
                {ttlBookingLabel ? (
                  <span className="text-xs font-semibold text-amber-800">
                    Hạn giữ chỗ: <span className="font-mono">{ttlBookingLabel}</span>
                  </span>
                ) : null}
              </div>

              <div className="grid gap-3 border-b border-slate-100 px-4 py-3 text-sm md:grid-cols-2">
                <div className="space-y-1.5">
                  <InfoLine label="Mã đơn hàng" value={booking.orderCode} mono strong />
                  {booking.sessionId ? <InfoLine label="Phiên booking" value={String(booking.sessionId)} mono /> : null}
                  {booking.pnr ? <InfoLine label="PNR chính" value={booking.pnr} mono strong tone="emerald" /> : null}
                </div>
                <div className="space-y-1.5">
                  {booking.customer?.fullName ? <InfoLine label="Hành khách" value={booking.customer.fullName} strong /> : null}
                  <InfoLine label="Số khách" value={paxLabel} />
                  {booking.customer?.phone ? (
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <span className="shrink-0 text-xs text-slate-500">Điện thoại</span>
                      <a className="min-w-0 truncate font-mono text-xs text-emerald-700 hover:underline" href={`tel:${booking.customer.phone}`}>
                        {booking.customer.phone}
                      </a>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {booking.itinerary.length > 0 ? (
                  booking.itinerary.map((leg) => <FlightLegRow key={leg.legKey} leg={leg} />)
                ) : (
                  <div className="px-4 py-4 text-sm text-slate-500">
                    <span className="font-semibold text-slate-700">{booking.routeSummary}</span>
                    {departLabel ? <span className="ml-2">· {departLabel}</span> : null}
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="order-1 min-w-0 lg:order-2 lg:sticky lg:top-6">
            {!intent ? (
              <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-center shadow-sm">
                <p className="text-sm font-semibold text-amber-900">Đang chuẩn bị mã QR cho booking này.</p>
                <button
                  type="button"
                  onClick={createIntent}
                  disabled={creating || balance <= 0}
                  className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-emerald-700 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creating ? "Đang tạo..." : "Tạo mã QR thanh toán"}
                </button>
                {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
              </section>
            ) : isFinalPaid ? (
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 text-center shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-white">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h2 className="mt-3 text-lg font-bold text-emerald-900">Thanh toán đã được xác nhận</h2>
                <p className="mt-1 text-sm text-emerald-700">
                  Hệ thống đã ghi nhận đủ {formatVnd(totalPaid)} ₫. Vé sẽ được xuất tự động.
                </p>
                {bookingStatus === "TICKETED" ? (
                  <p className="mt-2 text-xs text-emerald-600">Booking đã chuyển sang trạng thái TICKETED.</p>
                ) : null}
              </section>
            ) : isExpired ? (
              <section className="rounded-2xl border border-red-200 bg-red-50/80 p-6 text-center shadow-sm">
                <h2 className="text-lg font-bold text-red-700">QR thanh toán đã hết hạn</h2>
                <p className="mt-2 text-sm text-red-600">
                  Vui lòng liên hệ chăm sóc khách hàng hoặc tạo mã QR mới nếu booking còn hiệu lực.
                </p>
                <button
                  type="button"
                  onClick={createIntent}
                  disabled={creating || bookingStatus === "EXPIRED" || bookingStatus === "CANCELLED"}
                  className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-emerald-700 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Tạo mã QR mới
                </button>
              </section>
            ) : (
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-emerald-50/70 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700">Thanh toán bằng QR</p>
                  <div className="mt-1 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500">Số tiền</p>
                      <p className="text-2xl font-black tabular-nums text-emerald-800">{formatVnd(intent.amount)} ₫</p>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-right">
                      <p className="text-[10px] text-slate-500">Còn lại</p>
                      <p className={`font-mono text-sm font-bold tabular-nums ${ttl.label === "--:--" ? "text-slate-400" : "text-emerald-700"}`}>
                        {ttl.label}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid min-w-0 gap-4 p-4 md:grid-cols-[minmax(0,1fr)]">
                  <div className="flex min-w-0 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
                    {intent.qrCode ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={intent.qrCode}
                        alt="VietQR SePay"
                        className="aspect-square w-full max-w-[260px] rounded-md bg-white object-contain sm:max-w-[300px] lg:max-w-[320px]"
                      />
                    ) : (
                      <div className="flex aspect-square w-full max-w-[260px] items-center justify-center text-xs text-slate-400 sm:max-w-[300px]">
                        Đang tạo QR...
                      </div>
                    )}
                    <p className="mt-2 text-center text-[11px] text-slate-500">
                      Quét bằng app ngân hàng để thanh toán
                    </p>
                  </div>

                  <div className="min-w-0 space-y-3 text-sm">
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

                    <div className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                      <p className="font-semibold">Lưu ý quan trọng</p>
                      <p className="mt-1">
                        Vui lòng chuyển đúng số tiền và giữ nguyên nội dung{" "}
                        <span className="break-all font-mono font-semibold">{intent.transferContent}</span> để hệ thống tự động đối soát.
                      </p>
                    </div>

                    {isPartial ? (
                      <div className="rounded-xl bg-orange-50 p-3 text-xs text-orange-800">
                        Đã thanh toán một phần ({formatVnd(totalPaid)} ₫). Còn thiếu{" "}
                        <strong>{formatVnd(balance)} ₫</strong>.
                      </div>
                    ) : null}

                    {isManual ? (
                      <div className="rounded-xl bg-orange-50 p-3 text-xs text-orange-800">
                        Hệ thống nhận được giao dịch nhưng cần kiểm tra thủ công. Đại lý sẽ liên hệ trong ít phút.
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            )}
          </div>
        </main>

        {/* CSKH footer */}
        <footer className="mt-5 text-center text-xs text-slate-500">
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
    <div className="px-4 py-3.5">
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
          <span className="max-w-full rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold tracking-wider text-emerald-700 sm:ml-auto">
            PNR · {leg.pnr}
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {/* Departure */}
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold tabular-nums text-slate-950 sm:text-xl">
            {formatTimeOnly(leg.departureAt)}
          </p>
          <p className="text-base font-semibold text-slate-700">{leg.from || "—"}</p>
          <p className="text-[11px] text-slate-500">{formatDateOnly(leg.departureAt)}</p>
        </div>

        {/* Plane separator */}
        <div className="flex shrink-0 flex-col items-center px-1 text-slate-400 sm:px-2">
          <div className="h-px w-8 bg-slate-300 sm:w-12" />
          <svg className="my-1 h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.5 19l19-7L2.5 5l0 6 13 1-13 1z" />
          </svg>
          <div className="h-px w-8 bg-slate-300 sm:w-12" />
        </div>

        {/* Arrival */}
        <div className="min-w-0 flex-1 text-right">
          <p className="text-lg font-bold tabular-nums text-slate-950 sm:text-xl">
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

function InfoLine({
  label,
  value,
  mono,
  strong,
  tone = "slate",
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
  tone?: "slate" | "emerald";
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span className="shrink-0 text-xs text-slate-500">{label}</span>
      <span
        className={`min-w-0 truncate text-right text-xs ${
          strong ? "font-bold" : "font-medium"
        } ${mono ? "font-mono tracking-wide" : ""} ${tone === "emerald" ? "text-emerald-700" : "text-slate-900"}`}
      >
        {value}
      </span>
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
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
        <p
          className={`min-w-0 break-words text-base font-semibold leading-snug ${
            highlight ? "text-emerald-700" : "text-slate-900"
          } ${mono ? "break-all font-mono" : ""}`}
        >
          {value || "—"}
        </p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="h-10 shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700"
        aria-label={`Sao chép ${label}`}
        title={rawCopy ?? value}
      >
        {copied ? "Đã chép" : "Chép"}
      </button>
    </div>
  );
}
