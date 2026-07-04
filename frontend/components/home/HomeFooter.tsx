import type { Ref } from 'react';
import Image from 'next/image';

export default function HomeFooter({ footerRef }: { footerRef: Ref<HTMLElement> }) {
  return (
    <footer ref={footerRef}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 14px 14px' }}>
        <div style={{ borderRadius: 18, overflow: 'hidden', background: 'linear-gradient(120deg,#0c2740,#143a5c)', color: '#fff' }}>
          <div style={{ padding: '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid rgba(255,255,255,.08)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Image src="/assets/tanphu-apg-logo.jpg" alt="Tân Phú APG" width={46} height={46} className="object-contain" style={{ borderRadius: 10, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>TAN PHU APG</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.62)', marginTop: 1 }}>A member of Tan Phu Auto Transport Cooperative</div>
              </div>
            </div>
            <a href="tel:0918752686" style={{ border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.06)', borderRadius: 12, padding: '8px 16px', textAlign: 'right', flexShrink: 0, textDecoration: 'none', color: '#fff' }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.16em', color: 'rgba(255,255,255,.55)' }}>HOTLINE</div>
              <div className="apgx-mono" style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>0918.752.686</div>
            </a>
          </div>
          <div style={{ padding: 14, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,.5)' }}>
            <a href="/tra-cuu" style={{ color: 'rgba(255,255,255,.82)', textDecoration: 'none', fontWeight: 600 }}>Chuyến bay của tôi</a>
            <span style={{ margin: '0 8px' }}>·</span>
            © 2026 TAN PHU APG · MST: 4600111735 · tanphuapg.com
          </div>
        </div>
      </div>
    </footer>
  );
}
