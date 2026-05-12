import type { FlightBadge } from '@/lib/flight-badges';

export default function FlightBadgePills({
  badges,
  className = '',
}: {
  badges: FlightBadge[];
  className?: string;
}) {
  if (!badges.length) return null;

  const toneClass: Record<FlightBadge['tone'], string> = {
    cheapest: 'border-rose-200 bg-rose-50 text-rose-700',
    business: 'border-amber-200 bg-amber-50 text-amber-800',
    carryOn: 'border-sky-200 bg-sky-50 text-sky-700',
    checked: 'border-blue-200 bg-blue-50 text-blue-700',
  };

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {badges.map((badge) => (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-4 ${toneClass[badge.tone]}`}
          key={`${badge.key}-${badge.label}`}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}
