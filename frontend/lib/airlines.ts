export type AirlineMeta = { code: string; name: string; logo: string }

export const AIRLINE_META: Record<string, AirlineMeta> = {
  "VN": { "code": "VN", "name": "Vietnam Airlines", "logo": "https://images.kiwi.com/airlines/64/VN.png" },
  "VJ": { "code": "VJ", "name": "VietJet Air", "logo": "https://images.kiwi.com/airlines/64/VJ.png" },
  "QH": { "code": "QH", "name": "Bamboo Airways", "logo": "https://images.kiwi.com/airlines/64/QH.png" },
  "HU": { "code": "HU", "name": "Hainan Airlines", "logo": "https://images.kiwi.com/airlines/64/HU.png" },
  "BL": { "code": "BL", "name": "Pacific Airlines", "logo": "https://images.kiwi.com/airlines/64/BL.png" },
  "VU": { "code": "VU", "name": "Vietravel Airlines", "logo": "https://images.kiwi.com/airlines/64/VU.png" },
  "9G": { "code": "9G", "name": "Sun Phu Quoc Airways", "logo": "https://images.kiwi.com/airlines/64/9G.png" },
  "CZ": { "code": "CZ", "name": "China Southern Airlines", "logo": "https://images.kiwi.com/airlines/64/CZ.png" },
  "ZH": { "code": "ZH", "name": "Shenzhen Airlines", "logo": "https://images.kiwi.com/airlines/64/ZH.png" },
  "CA": { "code": "CA", "name": "Air China", "logo": "https://images.kiwi.com/airlines/64/CA.png" },
  "MU": { "code": "MU", "name": "China Eastern Airlines", "logo": "https://images.kiwi.com/airlines/64/MU.png" },
  "FM": { "code": "FM", "name": "Shanghai Airlines", "logo": "https://images.kiwi.com/airlines/64/FM.png" },
  "SQ": { "code": "SQ", "name": "Singapore Airlines", "logo": "https://images.kiwi.com/airlines/64/SQ.png" },
  "TG": { "code": "TG", "name": "Thai Airways", "logo": "https://images.kiwi.com/airlines/64/TG.png" },
  "CX": { "code": "CX", "name": "Cathay Pacific", "logo": "https://images.kiwi.com/airlines/64/CX.png" },
  "JL": { "code": "JL", "name": "Japan Airlines", "logo": "https://images.kiwi.com/airlines/64/JL.png" },
  "NH": { "code": "NH", "name": "ANA", "logo": "https://images.kiwi.com/airlines/64/NH.png" },
  "KE": { "code": "KE", "name": "Korean Air", "logo": "https://images.kiwi.com/airlines/64/KE.png" },
  "OZ": { "code": "OZ", "name": "Asiana Airlines", "logo": "https://images.kiwi.com/airlines/64/OZ.png" },
  "EK": { "code": "EK", "name": "Emirates", "logo": "https://images.kiwi.com/airlines/64/EK.png" },
  "QR": { "code": "QR", "name": "Qatar Airways", "logo": "https://images.kiwi.com/airlines/64/QR.png" },
  "LH": { "code": "LH", "name": "Lufthansa", "logo": "https://images.kiwi.com/airlines/64/LH.png" },
  "AF": { "code": "AF", "name": "Air France", "logo": "https://images.kiwi.com/airlines/64/AF.png" },
  "KL": { "code": "KL", "name": "KLM", "logo": "https://images.kiwi.com/airlines/64/KL.png" },
  "BA": { "code": "BA", "name": "British Airways", "logo": "https://images.kiwi.com/airlines/64/BA.png" },
  "TK": { "code": "TK", "name": "Turkish Airlines", "logo": "https://images.kiwi.com/airlines/64/TK.png" },
  "QF": { "code": "QF", "name": "Qantas", "logo": "https://images.kiwi.com/airlines/64/QF.png" },
  "UA": { "code": "UA", "name": "United Airlines", "logo": "https://images.kiwi.com/airlines/64/UA.png" },
  "AA": { "code": "AA", "name": "American Airlines", "logo": "https://images.kiwi.com/airlines/64/AA.png" },
  "DL": { "code": "DL", "name": "Delta Air Lines", "logo": "https://images.kiwi.com/airlines/64/DL.png" },
  "AK": { "code": "AK", "name": "AirAsia", "logo": "https://images.kiwi.com/airlines/64/AK.png" },
  "FD": { "code": "FD", "name": "Thai AirAsia", "logo": "https://images.kiwi.com/airlines/64/FD.png" },
  "D7": { "code": "D7", "name": "AirAsia X", "logo": "https://images.kiwi.com/airlines/64/D7.png" },
  "3U": { "code": "3U", "name": "Sichuan Airlines", "logo": "https://images.kiwi.com/airlines/64/3U.png" },
  "GJ": { "code": "GJ", "name": "Loong Air", "logo": "https://images.kiwi.com/airlines/64/GJ.png" },
  "GS": { "code": "GS", "name": "Tianjin Airlines", "logo": "https://images.kiwi.com/airlines/64/GS.png" },
  "HO": { "code": "HO", "name": "Juneyao Airlines", "logo": "https://images.kiwi.com/airlines/64/HO.png" },
  "MF": { "code": "MF", "name": "Xiamen Airlines", "logo": "https://images.kiwi.com/airlines/64/MF.png" },
};

function normalizeAirlineCode(value?: string): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function normalizeLogoUrl(value?: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\/assets\/airlines\//i.test(raw)) return raw;
  if (/^\/api\/airline-logo\//i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^\/\//.test(raw)) return `https:${raw}`;
  return '';
}

function cacheLogoUrl(code: string, sourceLogo: string): string {
  if (!sourceLogo) return '';
  if (/^\/assets\/airlines\//i.test(sourceLogo) || /^\/api\/airline-logo\//i.test(sourceLogo)) {
    return sourceLogo;
  }
  if (!/^https?:\/\//i.test(sourceLogo)) return sourceLogo;

  const safeCode = normalizeAirlineCode(code).slice(0, 10);
  if (!safeCode) return sourceLogo;

  return `/api/airline-logo/${encodeURIComponent(safeCode)}?src=${encodeURIComponent(sourceLogo)}`;
}

function isGenericProviderCode(code: string): boolean {
  return /^1[A-Z0-9]$/i.test(code);
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function scoreAirlineByName(airlineName: string): AirlineMeta | undefined {
  const inputTokens = tokenize(airlineName);
  if (inputTokens.length === 0) return undefined;

  let best: { meta: AirlineMeta; score: number } | undefined;
  for (const meta of Object.values(AIRLINE_META)) {
    const metaTokens = tokenize(meta.name);
    if (metaTokens.length === 0) continue;
    let matches = 0;
    for (const t of inputTokens) {
      if (metaTokens.includes(t)) matches++;
    }
    if (matches === 0) continue;
    const score = matches / Math.max(metaTokens.length, inputTokens.length);
    if (!best || score > best.score) best = { meta, score };
  }

  if (!best) return undefined;
  if (best.score < 0.5) return undefined;
  return best.meta;
}

export function getAirlineMeta(code?: string, airline?: string, preferredLogo?: string): AirlineMeta {
  const key = normalizeAirlineCode(code);
  const airlineName = String(airline || '').trim();
  const nameLooksLikeCode = !airlineName || normalizeAirlineCode(airlineName) === airlineName;

  const byCode = key && !isGenericProviderCode(key) ? AIRLINE_META[key] : undefined;

  const byName = !byCode && airlineName && !nameLooksLikeCode && airlineName.length >= 3
    ? scoreAirlineByName(airlineName)
    : undefined;

  const finalCode = byCode?.code || byName?.code || key;
  const finalName = airlineName || byCode?.name || byName?.name || finalCode;
  const sourceLogo = normalizeLogoUrl(preferredLogo) || byCode?.logo || byName?.logo || '';
  const finalLogo = cacheLogoUrl(finalCode, sourceLogo);

  return { code: finalCode, name: finalName, logo: finalLogo };
}
