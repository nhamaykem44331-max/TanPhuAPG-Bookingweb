/** Format VND price */
export function fmtVND(v: number): string {
  return Number(v || 0).toLocaleString('vi-VN') + ' ₫';
}

/** Date offset from today → YYYY-MM-DD */
export function toYmd(offset = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** ISO string → HH:mm */
export function hhmm(iso: string): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

/** Minutes → "2h 05m" */
export function durationText(minutes: number): string {
  if (!minutes || minutes <= 0) return '';
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

/** Vietnamese weekday short string */
export function vnWeekday(isoDate: string): string {
  const d = new Date(isoDate);
  const map = ['CN', 'T.Hai', 'T.Ba', 'T.Tư', 'T.Năm', 'T.Sáu', 'T.Bảy'];
  return `${map[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Airline → Tailwind bg color class */
export function airlineColorClass(name = ''): string {
  const n = name.toLowerCase();
  if (n.includes('vietnam')) return 'bg-sky-600';
  if (n.includes('vietjet')) return 'bg-red-600';
  if (n.includes('bamboo')) return 'bg-green-600';
  if (n.includes('vietravel')) return 'bg-amber-500';
  if (n.includes('shenzhen')) return 'bg-teal-700';
  return 'bg-slate-500';
}

/** Validate IATA code format (3 uppercase letters) */
export function isValidIATA(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

/** Validate date string YYYY-MM-DD */
export function isValidDate(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));
}
