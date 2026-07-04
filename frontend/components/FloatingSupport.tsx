'use client';

import { usePathname } from 'next/navigation';
import { PHONE_DISPLAY, PHONE_E164, ZALO_URL } from '@/lib/site';

// Nút hỗ trợ nổi (Zalo + gọi hotline) hiển thị xuyên suốt — kênh cứu vãn khi khách phân vân.
// Ẩn ở /dat-cho và /booking/payment: 2 màn này có footer CTA cao (dễ bị che) và đã có
// hotline/Zalo ngay trong ngữ cảnh. Ẩn khi in (print:hidden). Thông tin từ lib/site.ts.
const HIDE_ON = ['/dat-cho', '/booking/payment'];

export default function FloatingSupport() {
  const pathname = usePathname() || '';
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <div className="fixed right-4 bottom-6 z-40 flex flex-col items-end gap-2.5 print:hidden sm:right-6">
      <a
        href={ZALO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat Zalo với Tân Phú APG"
        title="Chat Zalo"
        className="flex items-center justify-center rounded-full text-white shadow-[0_8px_20px_rgba(0,104,255,0.35)] transition hover:scale-105 active:scale-95"
        style={{ background: '#0068FF', height: 52, width: 52 }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      </a>
      <a
        href={`tel:${PHONE_E164}`}
        aria-label={`Gọi hotline ${PHONE_DISPLAY}`}
        title={`Gọi ${PHONE_DISPLAY}`}
        className="flex items-center justify-center rounded-full text-white shadow-[0_8px_20px_rgba(31,122,84,0.35)] transition hover:scale-105 active:scale-95"
        style={{ background: '#1F7A54', height: 52, width: 52 }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 3.08 4.18 2 2 0 0 1 5 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      </a>
    </div>
  );
}
