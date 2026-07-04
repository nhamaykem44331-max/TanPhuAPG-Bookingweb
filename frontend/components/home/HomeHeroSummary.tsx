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
  return (
    <button
      type="button"
      onClick={onHomeClick}
      className="flex w-full items-center gap-4 overflow-hidden border border-[var(--apg-aviation-navy)] px-4 py-3 text-left shadow-sm lg:mt-4 lg:rounded-t-[var(--apg-radius-lg)] lg:px-5 lg:py-4"
      style={{ background: 'linear-gradient(135deg, var(--apg-aviation-navy-deep), var(--apg-aviation-navy-mid) 62%, var(--apg-aviation-navy-light))' }}
    >
      <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[10px] border border-white/12 bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] lg:h-[60px] lg:w-[60px]">
        <Image
          src="/assets/tanphu-apg-logo.jpg"
          alt="Tan Phu APG"
          width={46}
          height={46}
          className="h-10 w-10 rounded-[8px] object-contain lg:h-[46px] lg:w-[46px]"
          priority
        />
      </div>
      <div>
        <div className="apg-display text-[15px] font-semibold tracking-[0.08em] text-white lg:text-[18px]">TAN PHU APG</div>
        <div className="text-[10px] tracking-[0.04em] text-white/70 lg:text-[11px]">Corporate Aviation Services</div>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <div className="hidden rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-left text-[11px] text-white/70 lg:block">
          <div className="apg-display text-[10px] font-medium tracking-[0.2em] text-white/60">BOOKING DESK</div>
          <div className="apg-mono mt-0.5 font-semibold text-white/90">{fromCode || '---'} → {toCode || '---'}</div>
        </div>
        {hasMeta && !loading && (
          <div className="rounded-[var(--apg-radius-md)] border border-white/10 bg-white/10 px-3 py-2 text-right">
            <div className="apg-display text-[10px] font-medium tracking-[0.16em] text-white/70">Tìm thấy</div>
            <div className="apg-tabular text-base font-black text-white lg:text-[28px] lg:leading-none">{resultCount}</div>
            <div className="text-[10px] font-semibold text-white/80">chuyến</div>
          </div>
        )}
      </div>
    </button>
  );
}
