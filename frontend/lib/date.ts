const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DMY_DATE_RE = /^(\d{2})[-/](\d{2})[-/](\d{4})$/;

function assertRealDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  const normalized = date.toISOString().slice(0, 10);

  if (normalized !== iso) {
    throw new Error(`Ngày không hợp lệ: ${iso}`);
  }

  return iso;
}

export function toISO(value: string): string {
  const input = value.trim();

  if (ISO_DATE_RE.test(input)) {
    return assertRealDate(input);
  }

  const dmy = input.match(DMY_DATE_RE);

  if (!dmy) {
    throw new Error(`Ngày không đúng định dạng: ${value}`);
  }

  const [, day, month, year] = dmy;

  return assertRealDate(`${year}-${month}-${day}`);
}

export function formatDMY(iso: string): string {
  const normalized = toISO(iso);
  const [year, month, day] = normalized.split("-");

  return `${day}-${month}-${year}`;
}
