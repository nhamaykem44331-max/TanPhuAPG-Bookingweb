'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

const SLIDES = ['/landing/hero-1.jpg', '/landing/hero-2.jpg', '/landing/hero-3.jpg'];

// Hero: slideshow ảnh nền thật (cross-fade). Đã gỡ quả địa cầu canvas để hiển thị
// rõ ảnh. Giữ H1 tĩnh cho SEO; tôn trọng prefers-reduced-motion.
//
// Tối ưu LCP mobile:
//   - Ảnh qua next/image (AVIF/WebP + responsive) thay cho background-image JPG gốc.
//   - Slide 1 (LCP) priority; slide 2 & 3 chỉ mount khi trình duyệt rảnh (sau tải đầu)
//     để không tranh băng thông với ảnh LCP.
export default function HeroEffects() {
  const [active, setActive] = useState(0);
  const [mountRest, setMountRest] = useState(false);

  useEffect(() => {
    // Hoãn tải 2 slide còn lại tới khi rảnh — chúng vô hình trong ~5s đầu.
    const idleWin = window as typeof window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idleId = 0;
    let timerId: ReturnType<typeof setTimeout> | undefined;
    if (idleWin.requestIdleCallback) {
      idleId = idleWin.requestIdleCallback(() => setMountRest(true), { timeout: 2500 });
    } else {
      timerId = setTimeout(() => setMountRest(true), 1500);
    }

    const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    let rotate: ReturnType<typeof setInterval> | undefined;
    if (!reduce) {
      rotate = setInterval(() => setActive((a) => (a + 1) % SLIDES.length), 5200);
    }

    return () => {
      if (rotate) clearInterval(rotate);
      if (timerId) clearTimeout(timerId);
      if (idleId && idleWin.cancelIdleCallback) idleWin.cancelIdleCallback(idleId);
    };
  }, []);

  return (
    <>
      <div className="globe-bg">
        {SLIDES.map((src, i) => {
          if (i > 0 && !mountRest) return null;
          return (
            <div key={src} className={i === active ? 'gbg-slide active' : 'gbg-slide'}>
              <Image
                src={src}
                alt=""
                aria-hidden
                fill
                priority={i === 0}
                sizes="100vw"
                quality={55}
                className="gbg-img"
              />
            </div>
          );
        })}
      </div>
      <div className="globe-bg-overlay" />
      <div className="globe-vignette" />
    </>
  );
}
