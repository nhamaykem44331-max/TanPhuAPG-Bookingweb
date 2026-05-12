import type { Ref } from 'react';
import Image from 'next/image';

export default function HomeFooter({ footerRef }: { footerRef: Ref<HTMLElement> }) {
  const offices = [
    { eyebrow: 'Trụ sở chính', city: 'Thái Nguyên', address: 'Tổ 9, Phường Tích Lương, Tỉnh Thái Nguyên' },
    { eyebrow: 'Chi nhánh', city: 'Hà Nội', address: '323 Xuân Đỉnh, TP Hà Nội' },
    { eyebrow: 'Chi nhánh', city: 'Khánh Hòa', address: 'Phường Nha Trang, Tỉnh Khánh Hòa' },
    { eyebrow: 'Chi nhánh', city: 'Phú Thọ', address: 'Phường Phúc Yên, Tỉnh Phú Thọ' },
  ] as const;

  return (
    <footer
      ref={footerRef}
      className="overflow-hidden border border-t-0 border-[var(--apg-aviation-navy)] text-white shadow-sm lg:rounded-b-[var(--apg-radius-lg)]"
      style={{ background: 'linear-gradient(135deg, var(--apg-aviation-navy-deep), var(--apg-aviation-navy-mid) 62%, var(--apg-aviation-navy-light))' }}
    >
      <div className="border-b border-white/10 px-4 py-3 md:hidden">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-white/12 bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <Image src="/assets/tanphu-apg-logo.jpg" alt="Tan Phu APG" width={28} height={28} className="h-7 w-7 rounded-[6px] object-contain" />
          </div>
          <div className="min-w-0 flex-1 text-[10px] leading-relaxed text-white/78">
            <div className="apg-display text-[11px] font-semibold tracking-[0.08em] text-white">TAN PHU APG</div>
            <div className="truncate text-[9px] text-white/62">A member of Tan Phu Auto Transport Cooperative</div>
            <div className="mt-2 grid gap-1.5">
              <a href="tel:0918752686" className="inline-flex min-w-0 items-center gap-1.5 text-white/82">
                <span className="uppercase tracking-[0.12em] text-white/50">Hotline</span>
                <span className="apg-mono font-semibold text-white">0918.752.686</span>
              </a>
              <div className="min-w-0">
                <span className="uppercase tracking-[0.12em] text-white/50">Trụ sở chính</span>
                <span className="text-white/82"> · Thái Nguyên · Tổ 9, Phường Tích Lương</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden flex-col gap-4 border-b border-white/10 px-4 py-5 md:flex lg:flex-row lg:items-center lg:justify-between lg:px-6 lg:py-6">
        <div className="flex items-center gap-3 lg:gap-4">
          <div className="flex h-[44px] w-[44px] items-center justify-center rounded-[10px] border border-white/12 bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] lg:h-[52px] lg:w-[52px]">
            <Image src="/assets/tanphu-apg-logo.jpg" alt="Tan Phu APG" width={40} height={40} className="h-9 w-9 rounded-[8px] object-contain lg:h-10 lg:w-10" />
          </div>
          <div>
            <div className="apg-display text-[14px] font-semibold tracking-[0.08em] text-white lg:text-[16px]">TAN PHU APG</div>
            <div className="text-[10px] leading-snug tracking-[0.04em] text-white/70 lg:text-[11px]">A member of Tan Phu Auto Transport Cooperative</div>
          </div>
        </div>
        <a
          href="tel:0918752686"
          className="inline-flex items-center gap-3 self-start rounded-full border border-white/15 bg-white/10 px-4 py-2 transition hover:border-white/25 hover:bg-white/15 lg:self-auto"
        >
          <div className="text-left">
            <div className="apg-display text-[10px] font-medium uppercase tracking-[0.2em] text-white/60">Hotline</div>
            <div className="apg-mono text-sm font-semibold tabular-nums text-white">0918.752.686</div>
          </div>
        </a>
      </div>

      <div className="hidden gap-3 px-4 py-5 md:grid md:grid-cols-2 lg:grid-cols-4 lg:gap-4 lg:px-6 lg:py-6">
        {offices.map((office) => (
          <div
            key={office.city}
            className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.09]"
          >
            <div className="apg-display text-[9px] font-medium uppercase tracking-[0.18em] text-white/60">{office.eyebrow}</div>
            <div className="mt-1 apg-display text-sm font-semibold text-white">{office.city}</div>
            <div className="mt-1.5 text-[11px] leading-relaxed text-white/75">{office.address}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-white/10 bg-black/15 px-4 py-2.5 text-center text-[10px] text-white/85 lg:px-6 lg:py-3">
        <span>© 2026 TAN PHU APG</span>
        <span className="text-white/30">·</span>
        <span>MST: <span className="apg-mono tabular-nums">4600111735</span></span>
        <span className="text-white/30">·</span>
        <span>tanphuapg.com</span>
      </div>
    </footer>
  );
}
