'use client';

import { useEffect, useState } from 'react';

const SLIDES = ['/landing/hero-1.jpg', '/landing/hero-2.jpg', '/landing/hero-3.jpg'];

// Hero: slideshow ảnh nền thật (cross-fade). Đã gỡ quả địa cầu canvas
// để hiển thị rõ ảnh. Giữ H1 tĩnh cho SEO; tôn trọng prefers-reduced-motion.
export default function HeroEffects() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (reduce) return;
    const t = setInterval(() => setActive((a) => (a + 1) % SLIDES.length), 5200);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <div className="globe-bg">
        {SLIDES.map((src, i) => (
          <div
            key={src}
            className={i === active ? 'gbg-slide active' : 'gbg-slide'}
            style={{ backgroundImage: `url('${src}')` }}
          />
        ))}
      </div>
      <div className="globe-bg-overlay" />
      <div className="globe-vignette" />
    </>
  );
}
