"use client";

import Image from 'next/image';

export default function HomeHeroSummary({
  fromCode,
  hasMeta,
  loading,
  onHomeClick,
  resultCount,
  toCode,
}: {
  fromCode: string;
  hasMeta: boolean;
  loading: boolean;
  onHomeClick: () => void;
  resultCount: number;
  toCode: string;
}) {
  const showCount = hasMeta && !loading;
  const showRoute = !!(fromCode && toCode);

  return (
    <header className="apgx-topnav">
      <div className="in">
        <button type="button" onClick={onHomeClick} className="brand" aria-label="Về trang chủ Tân Phú APG">
          <Image
            src="/assets/tanphu-apg-logo.jpg"
            alt="Tân Phú APG"
            width={30}
            height={30}
            className="object-contain"
            priority
          />
          <span>
            Tân Phú APG
            <span className="sub block">Airlines Agent</span>
          </span>
        </button>

        <nav>
          <button type="button" className="on" onClick={onHomeClick}>Tìm vé</button>
          <a href="/quote">Báo giá</a>
          <a href="/admin/dashboard">Quản trị</a>
        </nav>

        <div className="right">
          {showRoute && (
            <span className="apgx-mono hidden text-[13px] font-semibold text-[var(--apg-text-secondary)] lg:inline">
              {fromCode} → {toCode}
            </span>
          )}
          {showCount && (
            <span className="apgx-countchip" aria-label={`Tìm thấy ${resultCount} chuyến`}>
              <span className="n">{resultCount}</span>
              <span className="l">chuyến</span>
            </span>
          )}
          <a className="iconbtn" href="tel:0918752686" title="Gọi hotline 0918.752.686" aria-label="Gọi hotline">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 3.08 4.18 2 2 0 0 1 5 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}
