'use client';

import './landing-header.css';
import Image from 'next/image';
import { useState } from 'react';
import HeaderGlobe from './HeaderGlobe';

// Header landing theo đúng thiết kế apgx-topnav của booktanphuapg
// (nền trắng kính mờ + logo thật), giữ các nút/nav hiện có của landing.
const NAV = [
  { href: '/#routes', label: 'Đường bay' },
  { href: '/#services', label: 'Vé đoàn' },
  { href: '/#services', label: 'Doanh nghiệp' },
  { href: '/#services', label: 'Vé thuyền viên' },
  { href: '/cam-nang', label: 'Cẩm nang' },
  { href: '/tra-cuu', label: 'Chuyến bay của tôi' },
];

const PhoneIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 3.08 4.18 2 2 0 0 1 5 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

export default function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="apgx-topnav apgx-globe">
      <HeaderGlobe />
      <div className="in">
        <a href="/" className="brand" aria-label="Trang chủ Tân Phú APG">
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
            <span className="sub block">Corporate Aviation Services</span>
          </span>
        </a>

        <nav>
          {NAV.map((n) => (
            <a key={n.label} href={n.href}>{n.label}</a>
          ))}
        </nav>

        <div className="right">
          <a className="apgx-cta" href="/dat-ve">Đặt vé</a>
          <a className="iconbtn" href="tel:0918752686" title="Gọi hotline 0918.752.686" aria-label="Gọi hotline">
            <PhoneIcon />
          </a>
          <button
            type="button"
            className="iconbtn menu-btn"
            aria-label="Mở menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className={menuOpen ? 'apgx-mobnav open' : 'apgx-mobnav'}>
        {NAV.map((n) => (
          <a key={n.label} href={n.href} onClick={() => setMenuOpen(false)}>{n.label}</a>
        ))}
        <a href="/dat-ve" onClick={() => setMenuOpen(false)}>Đặt vé</a>
        <a href="tel:0918752686" onClick={() => setMenuOpen(false)}>Hotline: 0918.752.686</a>
      </div>
    </header>
  );
}
