'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import HeaderGlobe from './landing/HeaderGlobe';
import './landing/landing-header.css';

// Header dùng chung cho các màn ngoài landing: tái dùng ĐÚNG giao diện header landing
// (nền navy + quả cầu đường bay động + logo + brand), nhưng mỗi màn tự truyền cụm nút
// riêng vào slot `right` (giữ nguyên vai trò nút của màn đó).
//
// KHÔNG dùng cho landing — landing giữ <LandingHeader> riêng (tuyệt đối không đổi).
export default function SiteGlobeHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="apgx-topnav apgx-globe">
      <HeaderGlobe />
      <div className="in">
        <a href="/" className="brand">
          <Image
            src="/assets/tanphu-apg-logo.jpg"
            alt=""
            width={30}
            height={30}
            className="object-contain"
            priority
          />
          <span>
            Tân Phú APG
            <span className="sub block">Corporate Aviation Services</span>
          </span>
        </a>

        <div className="right">
          <a
            href="/tra-cuu"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold text-white/90 transition hover:bg-white/10"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            <span className="hidden sm:inline">Chuyến bay của tôi</span>
          </a>
          {right}
        </div>
      </div>
    </header>
  );
}
