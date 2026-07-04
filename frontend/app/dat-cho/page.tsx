"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HoldBookingModal from '@/components/HoldBookingModal';
import { QUOTE_SELECTION_KEY, refreshSelection, type QuoteSelection } from '@/lib/refreshSelection';

export default function DatChoPage() {
  const router = useRouter();
  const [sel, setSel] = useState<QuoteSelection | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(QUOTE_SELECTION_KEY);
      if (raw) setSel(JSON.parse(raw) as QuoteSelection);
    } catch { /* noop */ }
    setReady(true);
  }, []);

  // Re-price the selection in place when the search session expires (no full reload).
  const handleRefresh = useCallback(async () => {
    if (!sel) return;
    const next = await refreshSelection(sel);
    localStorage.setItem(QUOTE_SELECTION_KEY, JSON.stringify(next));
    setSel(next);
    return { searchExpiresAt: next.searchExpiresAt };
  }, [sel]);

  const handleClose = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/dat-ve');
  }, [router]);

  if (!ready) return null;

  if (!sel?.outbound) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--apg-bg-page)] p-6 text-center">
        <div>
          <p className="mb-4 text-sm text-[#666]">Chưa có chuyến bay được chọn để đặt vé.</p>
          <button type="button" onClick={() => router.push('/dat-ve')} className="apg-btn-primary h-11 px-5 text-sm font-bold text-white">Quay lại tìm vé</button>
        </div>
      </div>
    );
  }

  return (
    <HoldBookingModal
      asPage
      open
      flight={sel.outbound}
      inbound={sel.inbound ?? null}
      tripType={sel.tripType}
      search={sel.search}
      adults={sel.adults}
      children={sel.children}
      infants={sel.infants}
      cabin={sel.cabin}
      quoteCode={sel.quoteCode}
      selectionExpiresAt={sel.searchExpiresAt}
      onClose={handleClose}
      onRefresh={handleRefresh}
      onExportQuote={() => router.push('/quote')}
      onHeld={() => {
        // Hold thành công → bỏ selection để nút Back không cho đặt lại (tránh PNR trùng).
        // KHÔNG tự điều hướng: để modal hiện màn kết quả với 2 lựa chọn
        // "Thanh toán ngay" / "Giữ chỗ · thanh toán sau".
        try { localStorage.removeItem(QUOTE_SELECTION_KEY); } catch { /* noop */ }
      }}
    />
  );
}
