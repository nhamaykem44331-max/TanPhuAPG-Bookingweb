'use client';

import TicketFace, { type TicketProps } from '@/components/ticket/TicketFace';
import { useTicketExport } from '@/lib/ticket/useTicketExport';

// Mặt vé tải được: bọc <TicketFace> trong vùng chụp + nút Tải PDF / Tải ảnh.
// Dùng ở màn thanh toán thành công, trang tra cứu đơn, và mặt vé đang giữ.

export default function DownloadableTicket({
  ticket,
  fileBaseName = 'MatVe-TanPhuAPG',
}: {
  ticket: TicketProps;
  fileBaseName?: string;
}) {
  const { printRef, exporting, exportError, exportPdf, exportJpg } = useTicketExport(fileBaseName);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={exportPdf}
          disabled={exporting !== null}
          className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold text-white shadow-sm transition disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg,#0C2740,#143A5C,#1A4E78)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          {exporting === 'pdf' ? 'Đang tạo PDF…' : 'Tải mặt vé (PDF)'}
        </button>
        <button
          type="button"
          onClick={exportJpg}
          disabled={exporting !== null}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#C9C9C9] bg-white px-4 text-sm font-bold text-[#0C2740] transition hover:border-[#0C2740] disabled:opacity-60"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
          {exporting === 'jpg' ? 'Đang tạo ảnh…' : 'Tải ảnh'}
        </button>
      </div>
      {exportError ? <p className="text-sm text-red-600">{exportError}</p> : null}
      <div ref={printRef} className="w-full">
        <TicketFace {...ticket} />
      </div>
    </div>
  );
}
