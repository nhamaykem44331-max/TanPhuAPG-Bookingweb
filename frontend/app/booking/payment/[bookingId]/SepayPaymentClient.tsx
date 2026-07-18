"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import SiteGlobeHeader from "@/components/SiteGlobeHeader";
import BookingStepper from "@/components/BookingStepper";
import DownloadableTicket from "@/components/ticket/DownloadableTicket";
import { bookingToTicketProps, type AirportName } from "@/lib/ticket/bookingToTicketProps";
import { toTicketSourceLegs } from "@/lib/booking/ticketView";
import { isRealPnr, friendlyPnrIssue } from "@/lib/booking/pnrDisplay";
import { TAX_ID } from "@/lib/site";
import { useAirports } from "@/lib/useAirports";

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
    baggageChecked: string | null;
    baggageCarryOn: string | null;
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
  passengers: { type: string; firstName: string; lastName: string; title?: string; dob?: string }[];
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
  payLater?: boolean;
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

// Map trạng thái booking (GDS/hệ thống) sang nhãn tiếng Việt cho khách.
function bookingStatusVi(status: string): string {
  const map: Record<string, string> = {
    HELD: "Đang giữ chỗ",
    PENDING_PAYMENT: "Chờ thanh toán",
    PAID: "Đã thanh toán",
    TICKETING: "Đang xuất vé",
    TICKETED: "Đã xuất vé",
    EXPIRED: "Đã hết hạn",
    CANCELLED: "Đã huỷ",
  };
  return map[status] ?? "Đang xử lý";
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

export function SepayPaymentClient({ booking, initialIntent, payLater = false }: Props) {
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

  // balance <= 0 = không còn gì để trả (đã đủ tiền HOẶC đơn 0đ) → coi như xong, tránh kẹt
  // ở màn "đang chuẩn bị QR" với nút bị khoá.
  const isFinalPaid = paymentStatus === "PAID" || balance <= 0;
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

  // Polling 4s. Chỉ DỪNG ở trạng thái kết thúc thật (đã thanh toán hoặc booking bị huỷ) —
  // KHÔNG dừng khi QR vừa hết giờ đếm ngược, để một giao dịch chuyển sát hạn (webhook trễ)
  // vẫn được bắt và lật trang sang "thành công". Tạm dừng khi tab ẩn, fetch ngay khi quay lại.
  useEffect(() => {
    if (isFinalPaid || bookingStatus === "CANCELLED") return;
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (id === null) id = setInterval(fetchStatus, 4000); };
    const stop = () => { if (id !== null) { clearInterval(id); id = null; } };
    const onVisibility = () => {
      if (document.hidden) stop();
      else { void fetchStatus(); start(); }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [fetchStatus, isFinalPaid, bookingStatus]);

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
  // Số tiền hiển thị: trước khi trả xong = số CÒN THIẾU (balance) để không lệch khi trả thiếu;
  // sau khi trả xong = tổng đã trả.
  const payableAmount = isFinalPaid ? totalPaid : (balance > 0 ? balance : intent?.amount ?? 0);

  const { airports } = useAirports();
  const airportNames = useMemo(() => {
    const m: Record<string, AirportName> = {};
    for (const a of airports) m[a.code] = { city: a.city, name: a.name };
    return m;
  }, [airports]);

    const ticketLegs = useMemo(() => toTicketSourceLegs(booking.itinerary), [booking.itinerary]);

  const paidTicket = useMemo(
    () =>
      bookingToTicketProps(
        {
          status: "paid",
          referenceCode: booking.pnr || booking.orderCode,
          legs: ticketLegs,
          passengers: booking.passengers,
          total: booking.saleAmount,
          paid: { totalPaid: totalPaid || booking.saleAmount, paidAtIso: intent?.paidAt ?? null },
        },
        airportNames,
      ),
    [ticketLegs, booking.pnr, booking.orderCode, booking.passengers, booking.saleAmount, totalPaid, intent?.paidAt, airportNames],
  );

  const holdTicket = useMemo(() => {
    if (!intent) return null;
    const staticQr =
      intent.bankCode && intent.accountNumber
        ? `https://img.vietqr.io/image/${intent.bankCode}-${intent.accountNumber}-compact2.png?amount=${payableAmount}&addInfo=${encodeURIComponent(intent.transferContent)}`
        : intent.qrCode || "";
    return bookingToTicketProps(
      {
        status: "hold",
        referenceCode: booking.pnr || booking.orderCode,
        legs: ticketLegs,
        passengers: booking.passengers,
        total: booking.saleAmount,
        hold: {
          amountDue: payableAmount,
          bankCode: intent.bankCode,
          bankAccount: intent.accountNumber,
          bankAccountName: intent.accountName ?? undefined,
          transferContent: intent.transferContent,
          qrImageUrl: staticQr,
          deadlineIso: booking.ttlExpiresAt,
        },
      },
      airportNames,
    );
  }, [intent, ticketLegs, booking.pnr, booking.orderCode, booking.passengers, booking.saleAmount, booking.ttlExpiresAt, payableAmount, airportNames]);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'linear-gradient(to bottom,#EAF0F6,#F4F2EC 42%)' }}>
      <SiteGlobeHeader />
      <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-4 md:py-8 lg:px-6">
        <header className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end lg:mb-5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#1F7A54]">
              {isFinalPaid ? "Đã thanh toán" : "Thanh toán an toàn · SePay"}
            </p>
            <h1 className="mt-1 text-[25px] font-semibold leading-[1.15] text-[#0B1E16] md:text-[28px]" style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}>
              {isFinalPaid ? "Thanh toán thành công" : "Quét mã QR để thanh toán"}
            </h1>
            <p className="mt-1 text-xs text-[#7A8893]">
              Mã đơn <span className="font-mono font-semibold text-[#16212B]">{booking.orderCode}</span>
              {booking.pnr ? <> · PNR <span className="font-mono font-bold text-[#1F7A54]">{booking.pnr}</span></> : null}
            </p>
          </div>
          <div className="rounded-xl px-4 py-2.5 text-white shadow-sm sm:min-w-[200px] sm:text-right" style={{ background: isFinalPaid ? 'linear-gradient(135deg,#1f5f44,#248a3d)' : 'linear-gradient(135deg,#0C2740,#143A5C,#1A4E78)' }}>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/70">{isFinalPaid ? "Đã thanh toán" : "Cần thanh toán"}</p>
            <p className="text-[24px] font-semibold tabular-nums" style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}>{formatVnd(payableAmount)} ₫</p>
            <p className="mt-0.5 text-[9.5px] text-white/60">Đã gồm thuế &amp; phí</p>
          </div>
        </header>

        <div className="mb-4"><BookingStepper stage={isFinalPaid ? "done" : "pay"} /></div>

        <main className="flex flex-col gap-4">
          {!isFinalPaid && !(payLater && holdTicket) && (
          <div className="order-2 min-w-0 lg:order-1">
            <section className="overflow-hidden rounded-[18px] border border-[#E5E2D9] bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-[#EDEAE1] bg-[#FAF8F3] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9C7B3E]">Hành trình</span>
                  <span className="rounded-[5px] border border-[#E5E2D9] bg-white px-2.5 py-0.5 text-[10.5px] font-semibold text-[#586675]">
                    {booking.tripType === "ROUNDTRIP" ? "Khứ hồi" : "Một chiều"}
                  </span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider ${
                    bookingStatus === "TICKETED"
                      ? "border-[#A7E8C7] bg-[#EBFBF2] text-[#1F7A54]"
                      : bookingStatus === "HELD"
                      ? "border-amber-300 bg-amber-50 text-amber-700"
                      : "border-slate-300 bg-slate-50 text-slate-700"
                  }`}>
                    {bookingStatusVi(bookingStatus)}
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
                  {booking.pnr ? <InfoLine label="PNR chính" value={booking.pnr} mono strong tone="brand" /> : null}
                </div>
                <div className="space-y-1.5">
                  {booking.customer?.fullName ? <InfoLine label="Hành khách" value={booking.customer.fullName} strong /> : null}
                  <InfoLine label="Số khách" value={paxLabel} />
                  {booking.customer?.phone ? (
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <span className="shrink-0 text-xs text-slate-500">Điện thoại</span>
                      <a className="min-w-0 truncate font-mono text-xs text-brand-700 hover:underline" href={`tel:${booking.customer.phone}`}>
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
          )}

          <div className="order-1 min-w-0 lg:order-2">
            {!intent ? (
              <section className="rounded-[18px] border border-[#ECD9AE] bg-[#FCF8EE] p-6 text-center shadow-sm">
                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[#86671F]">
                  {creating && <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.2-8.6" strokeLinecap="round" /></svg>}
                  <span>{creating ? "Đang tạo mã QR thanh toán…" : "Đang chuẩn bị mã QR cho booking này."}</span>
                </div>
                <button
                  type="button"
                  onClick={createIntent}
                  disabled={creating || balance <= 0}
                  className="mt-4 inline-flex h-11 items-center justify-center rounded-lg px-6 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#1f5f44,#248a3d)' }}
                >
                  {creating ? "Đang tạo..." : "Tạo mã QR thanh toán"}
                </button>
                {error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}
              </section>
            ) : isFinalPaid ? (
              <section role="status" aria-live="polite" className="rounded-[18px] border border-[#A7E8C7] bg-[#F2FBF6] px-4 py-6 shadow-sm sm:px-6">
                <div className="mx-auto mb-4 flex max-w-[600px] flex-col items-center text-center">
                  <div className="mb-3 grid h-[54px] w-[54px] place-items-center rounded-full border-[1.5px] border-[#A7E8C7] bg-[#DCF5E7]">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-[#1F7A54]">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#fff" strokeWidth="2.6"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                  </div>
                  <h2 className="text-[21px] font-semibold text-[#0B5337]" style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}>
                    {bookingStatus === "TICKETED" ? "Đã xuất vé" : "Thanh toán thành công"}
                  </h2>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-[#0B5337]">
                    {bookingStatus === "TICKETED" ? (
                      <>Đã ghi nhận đủ <b>{formatVnd(totalPaid)} ₫</b> · vé điện tử sẵn sàng bên dưới.</>
                    ) : (
                      <>Đã ghi nhận đủ <b>{formatVnd(totalPaid)} ₫</b>. Vé đang được xuất — số vé sẽ hiện trên mặt vé khi hoàn tất.</>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-[#3B6D57]">
                    Mã đơn <span className="font-mono font-semibold text-[#0B5337]">{booking.orderCode}</span>
                    {booking.pnr ? <> · PNR <span className="font-mono font-semibold text-[#0B5337]">{booking.pnr}</span></> : null}
                  </p>
                  {booking.customer?.email ? (
                    <p className="mt-0.5 text-xs text-[#3B6D57]">Bản vé cũng được gửi tới <b>{booking.customer.email}</b>.</p>
                  ) : null}
                </div>

                <DownloadableTicket ticket={paidTicket} fileBaseName={`Ve-${booking.orderCode}`} />

                <div className="mx-auto mt-5 flex max-w-[600px] flex-wrap items-center justify-center gap-2">
                  <Link href="/tra-cuu" className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#CBD8E4] bg-white px-4 text-sm font-semibold text-[#143A5C] transition hover:border-[#143A5C]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                    Chuyến bay của tôi
                  </Link>
                  <Link href="/dat-ve" className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#CBD8E4] bg-white px-4 text-sm font-semibold text-[#143A5C] transition hover:border-[#143A5C]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M2.5 19l19-7L2.5 5l0 6 13 1-13 1z" /></svg>
                    Đặt vé khác
                  </Link>
                  <Link href="/" className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#CBD8E4] bg-white px-4 text-sm font-semibold text-[#143A5C] transition hover:border-[#143A5C]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></svg>
                    Về trang chủ
                  </Link>
                </div>
              </section>
            ) : isExpired ? (
              <section className="rounded-[18px] border border-red-200 bg-red-50 px-5 py-8 text-center shadow-sm">
                <h2 className="text-lg font-bold text-red-700">QR thanh toán đã hết hạn</h2>
                <p className="mt-2 text-sm text-red-600">Vui lòng liên hệ chăm sóc khách hàng hoặc tạo mã QR mới nếu booking còn hiệu lực.</p>
                <p className="mt-2 text-[12.5px] text-slate-500">Nếu bạn vừa chuyển khoản, hệ thống vẫn đang tự kiểm tra — vui lòng đợi vài phút, trang sẽ tự cập nhật khi nhận được tiền.</p>
                <button
                  type="button"
                  onClick={createIntent}
                  disabled={creating || bookingStatus === "EXPIRED" || bookingStatus === "CANCELLED"}
                  className="mt-4 inline-flex h-11 items-center justify-center rounded-lg px-6 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#1f5f44,#248a3d)' }}
                >
                  Tạo mã QR mới
                </button>
              </section>
            ) : payLater && holdTicket ? (
              <section className="rounded-[18px] border border-[#ECD9AE] bg-[#FCFAF4] px-4 py-6 shadow-sm sm:px-6">
                <div className="mx-auto mb-4 max-w-[600px] rounded-xl border border-[#ECD9AE] bg-[#FDF6E7] px-4 py-3 text-center">
                  <p className="text-[13.5px] font-semibold text-[#86671F]">
                    Chỗ của bạn đang được giữ{ttlBookingLabel ? <> đến <span className="font-mono">{ttlBookingLabel}</span></> : null}.
                  </p>
                  <p className="mt-0.5 text-xs text-[#86671F]">
                    Tải mặt vé để lưu, quét QR trên mặt vé để thanh toán, hoặc quay lại bất cứ lúc nào ở mục Chuyến bay của tôi (mã <span className="font-mono">{booking.orderCode}</span> + số điện thoại).
                  </p>
                </div>

                <DownloadableTicket ticket={holdTicket} fileBaseName={`GiuCho-${booking.orderCode}`} />

                <div className="mx-auto mt-5 flex max-w-[600px] flex-wrap items-center justify-center gap-2">
                  <a
                    href={`/booking/payment/${booking.id}`}
                    className="inline-flex h-10 items-center gap-2 rounded-lg px-5 text-sm font-bold text-white shadow-sm"
                    style={{ background: 'linear-gradient(135deg,#1f5f44,#248a3d)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    Thanh toán ngay
                  </a>
                  <Link
                    href="/tra-cuu"
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#CBD8E4] bg-white px-4 text-sm font-semibold text-[#143A5C] transition hover:border-[#143A5C]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                    Chuyến bay của tôi
                  </Link>
                </div>
              </section>
            ) : (
              <div className="grid items-start gap-4 sm:grid-cols-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#586675] sm:col-span-2">Chọn cách thanh toán</p>
                {/* QR card (green) */}
                <section className="min-w-0 overflow-hidden rounded-[18px] border border-[#E5E2D9] bg-white shadow-sm">
                  <div className="flex items-end justify-between border-b border-[#CFF0DD] bg-[#EBFBF2] px-4 py-3">
                    <div>
                      <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#1F7A54]">Quét QR để thanh toán</p>
                      <p className="text-[21px] font-semibold tabular-nums text-[#0B5337]" style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}>{formatVnd(intent.amount)} ₫</p>
                    </div>
                    <div className="rounded-[10px] border border-[#A7E8C7] bg-white px-2.5 py-1.5 text-right">
                      <p className="text-[9px] text-[#93A0AC]">Còn lại</p>
                      <p className={`font-mono text-[15px] font-bold tabular-nums ${ttl.label === "--:--" ? "text-slate-400" : "text-[#1F7A54]"}`}>{ttl.label === "--:--" ? "Đang tạo…" : ttl.label}</p>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex flex-col items-center rounded-[14px] border border-[#E8E5DC] bg-[#FAF9F6] p-4">
                      {intent.qrCode ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={intent.qrCode} alt="VietQR SePay" className="aspect-square w-full max-w-[230px] rounded-md bg-white object-contain" />
                      ) : (
                        <div className="flex aspect-square w-full max-w-[230px] items-center justify-center text-xs text-slate-400">Đang tạo QR...</div>
                      )}
                      <p className="mt-2.5 text-center text-[11.5px] text-[#93A0AC]">Quét bằng app ngân hàng để thanh toán</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[11px] font-extrabold text-[#0A4EA3]">VietQR</span>
                        <span className="border-l border-[#DCD9D0] pl-2 text-[11px] font-extrabold text-[#1F7A54]">SePay</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Bank transfer card (gold) */}
                <section className="min-w-0 overflow-hidden rounded-[18px] border border-[#E5E2D9] bg-white shadow-sm">
                  <div className="border-b border-[#EDEAE1] px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9C7B3E]">Hoặc chuyển khoản thủ công</p>
                  </div>
                  <div className="flex flex-col px-4 pb-4 pt-0.5">
                    <CopyRow label="Ngân hàng" value={intent.bankCode || ""} onCopy={() => copy(intent.bankCode || "", "bank")} copied={copied === "bank"} />
                    <CopyRow label="Số tài khoản" value={intent.accountNumber || ""} onCopy={() => copy(intent.accountNumber || "", "acc")} copied={copied === "acc"} mono />
                    {intent.accountName ? (
                      <CopyRow label="Chủ tài khoản" value={intent.accountName} onCopy={() => copy(intent.accountName || "", "name")} copied={copied === "name"} />
                    ) : null}
                    <CopyRow label="Số tiền" value={`${formatVnd(intent.amount)} ₫`} rawCopy={String(intent.amount)} onCopy={() => copy(String(intent.amount), "amount")} copied={copied === "amount"} highlight />
                    <CopyRow label="Nội dung CK" value={intent.transferContent} onCopy={() => copy(intent.transferContent, "content")} copied={copied === "content"} mono highlight />

                    <div className="mt-3 flex items-start gap-2 rounded-[12px] border border-[#ECD9AE] bg-[#FCF8EE] px-3 py-2.5 text-[11.5px] leading-relaxed text-[#86671F]">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B5862B" strokeWidth="2" className="mt-px shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                      <span>Giữ nguyên nội dung <b className="font-mono font-bold text-[#7A4F0A]">{intent.transferContent}</b> để hệ thống <b>tự động đối soát</b> &amp; xuất vé.</span>
                    </div>

                    {isPartial ? (
                      <div className="mt-2 rounded-[12px] bg-orange-50 px-3 py-2.5 text-xs text-orange-800">
                        Đã thanh toán một phần ({formatVnd(totalPaid)} ₫). Còn thiếu <strong>{formatVnd(balance)} ₫</strong>.
                        <button
                          type="button"
                          onClick={createIntent}
                          disabled={creating}
                          className="mt-2 block w-full rounded-md border border-orange-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-orange-800 transition hover:bg-orange-100 disabled:opacity-60"
                        >
                          {creating ? "Đang cập nhật…" : "Cập nhật mã QR cho số còn lại"}
                        </button>
                      </div>
                    ) : null}
                    {isManual ? (
                      <div className="mt-2 rounded-[12px] bg-orange-50 px-3 py-2.5 text-xs text-orange-800">Hệ thống đã nhận giao dịch nhưng cần kiểm tra thủ công. Đại lý sẽ kiểm tra và liên hệ lại sớm nhất — hoặc gọi ngay 0918.752.686.</div>
                    ) : null}

                    <p className="mt-2.5 text-center text-[11px] text-[#93A0AC]">Hệ thống tự kiểm tra mỗi 4 giây — không cần bấm gì thêm.</p>
                  </div>
                </section>
              </div>
            )}
          </div>
        </main>

        <PaymentAssurance finalPaid={isFinalPaid} />

        {/* CSKH footer */}
        <footer className="mt-5 text-center text-xs text-[#93A0AC]">
          Cần hỗ trợ?{" "}
          <a className="font-semibold text-[#1F7A54] hover:underline" href="tel:0918752686">
            0918.752.686
          </a>{" "}
          hoặc{" "}
          <a className="font-semibold text-[#1F7A54] hover:underline" href="https://zalo.me/0918752686">
            chat Zalo
          </a>
        </footer>
      </div>
    </div>
  );
}

function PaymentAssurance({ finalPaid }: { finalPaid: boolean }) {
  return (
    <section className="mt-4">
      {!finalPaid ? (
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-2xl border border-[#BFE0CC] bg-[#F2FBF6] px-4 py-3 text-[12px] font-medium text-[#0F7B43]">
          <a href="/huong-dan-dat-ve" className="inline-flex items-center gap-1.5 hover:underline">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
            Xuất vé tự động ngay khi nhận đủ tiền
          </a>
          <span className="inline-flex items-center gap-1.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" /></svg>
            HTX Tân Phú APG · MST {TAX_ID}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            Không nhập thẻ trên web · trả trong app ngân hàng · SePay đối soát tự động
          </span>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11.5px] text-[#93A0AC]">
        <span>{finalPaid ? "Bạn đã đồng ý" : "Khi thanh toán, bạn đồng ý"}</span>
        <a href="/hoan-doi-huy-ve" className="text-[#143A5C] hover:underline">Điều kiện hoàn/đổi/hủy</a>
        <span>·</span>
        <a href="/huong-dan-dat-ve" className="text-[#143A5C] hover:underline">Hướng dẫn đặt vé</a>
        <span>·</span>
        <a href="/cau-hoi-thuong-gap" className="text-[#143A5C] hover:underline">Câu hỏi thường gặp</a>
      </div>
    </section>
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
        <span className="rounded bg-[#143A5C] px-2.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-white">
          {leg.legLabel}
        </span>
        {leg.airline ? (
          <span className="text-[11px] font-semibold text-[#586675]">
            {leg.airline}
            {leg.flightNumber ? ` ${leg.flightNumber}` : ""}
          </span>
        ) : null}
        {leg.cabin ? (
          <span className="text-[11px] text-slate-500">{leg.cabin}</span>
        ) : null}
        {leg.pnr && isRealPnr(leg.pnr) ? (
          <span className="max-w-full rounded-full border border-[#CBD8E4] bg-[#EEF3F8] px-2.5 py-0.5 font-mono text-[10.5px] font-bold tracking-wider text-[#143A5C] sm:ml-auto">
            PNR · {leg.pnr}
          </span>
        ) : friendlyPnrIssue(leg.pnr) ? (
          <span className="max-w-full rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[10.5px] font-semibold text-amber-800 sm:ml-auto">
            {friendlyPnrIssue(leg.pnr)}
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
          <svg className="my-1 h-4 w-4 text-brand-600" viewBox="0 0 24 24" fill="currentColor">
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
  tone?: "slate" | "brand";
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span className="shrink-0 text-xs text-slate-500">{label}</span>
      <span
        className={`min-w-0 truncate text-right text-xs ${
          strong ? "font-bold" : "font-medium"
        } ${mono ? "font-mono tracking-wide" : ""} ${tone === "brand" ? "text-brand-700" : "text-slate-900"}`}
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
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[#F1EEE6] py-2.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.04em] text-[#93A0AC]">{label}</p>
        <p
          className={`min-w-0 break-words text-[15px] font-semibold leading-snug ${
            highlight ? "text-[#1F7A54]" : "text-[#16212B]"
          } ${mono ? "break-all font-mono" : ""}`}
        >
          {value || "—"}
        </p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="h-11 shrink-0 rounded-lg border border-[#E5E2D9] bg-white px-3.5 text-xs font-semibold text-[#586675] transition hover:border-[#1F7A54] hover:text-[#1F7A54]"
        aria-label={`Sao chép ${label}`}
        title={rawCopy ?? value}
      >
        {copied ? "Đã chép" : "Chép"}
      </button>
    </div>
  );
}
