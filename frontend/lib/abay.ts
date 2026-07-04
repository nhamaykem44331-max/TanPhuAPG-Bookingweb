import { load } from 'cheerio';

export interface AbaySearchInput {
  from: string;
  to: string;
  date: string;
  adults?: number;
  children?: number;
  infants?: number;
  cabin?: 'economy' | 'premium' | 'business' | 'first';
}

export interface AbayFlightRow {
  source: 'abay.vn';
  airline: string;
  flight_number: string;
  origin_iata: string;
  destination_iata: string;
  scheduled_departure: string;
  scheduled_arrival: string;
  duration_minutes: number;
  stops: number;
  price: number;
  base_price?: number;
  taxes_fees?: number;
  total_price?: number;
  detail_url?: string;
  currency: 'VND';
  cabinClass: 'economy' | 'business';
}

type AbayAjaxResponse = { d?: string };
type AbayFlightItem = {
  E?: string; F?: string; G?: string; H?: string; J?: string | number; L?: string | number; T?: string; N?: string; FareClass?: string;
};
type IntlSearchSettings = {
  LookupResultFromDomain: string;
  GetSearchResult: string;
};
type IntlSearchInfo = Record<string, unknown>;
export type AbayFareBreakdown = { basePrice: number; taxesFees: number; totalPrice: number };

const AIRPORT_CITY_TEXT: Record<string, string> = {
  HAN: 'Ha Noi', SGN: 'Tp Ho Chi Minh', DAD: 'Da Nang', CXR: 'Nha Trang', PQC: 'Phu Quoc', HPH: 'Hai Phong',
  VII: 'Vinh', HUI: 'Hue', VCA: 'Can Tho', DLI: 'Da Lat', UIH: 'Quy Nhon', BMV: 'Buon Me Thuot', VDO: 'Quang Ninh', THD: 'Thanh Hoa',
  CAN: 'Guangzhou', BKK: 'Bangkok', SIN: 'Singapore', KUL: 'Kuala Lumpur', ICN: 'Seoul', NRT: 'Tokyo Narita', HKG: 'Hong Kong',
  MEL: 'Melbourne', SYD: 'Sydney', PEK: 'Beijing', PVG: 'Shanghai', SZX: 'Shenzhen',
};

const AIRLINE_BY_CODE: Record<string, string> = {
  VN: 'Vietnam Airlines', VJ: 'VietJet Air', QH: 'Bamboo Airways', VU: 'Vietravel Airlines', BL: 'Pacific Airlines', '9G': 'Sun Phu Quoc Airways',
  CZ: 'China Southern Airlines', ZH: 'Shenzhen Airlines', CA: 'Air China', MU: 'China Eastern Airlines', FM: 'Shanghai Airlines',
  SQ: 'Singapore Airlines', TG: 'Thai Airways', CX: 'Cathay Pacific', JL: 'Japan Airlines', NH: 'ANA', KE: 'Korean Air', OZ: 'Asiana Airlines',
  '3U': 'Sichuan Airlines', GJ: 'Loong Air', GS: 'Tianjin Airlines', MF: 'Xiamen Airlines',
};

const DOMESTIC_AIRPORTS = new Set([
  'HAN','SGN','DAD','CXR','PQC','HPH','VII','HUI','VCA','DLI','UIH','BMV','VDO','THD','DIN','PXU','TBB','VCS','VKG','VDH','VCL','CAH'
]);

function cityText(iata: string): string { return AIRPORT_CITY_TEXT[iata.toUpperCase()] || iata.toUpperCase(); }
function parseMoneyVnd(raw: string | number | undefined): number { return Number(String(raw ?? '').replace(/[^\d]/g, '')) || 0; }

function airlineNameFromFlightNo(flightNo: string, airlineCode?: string): string {
  const prefix = airlineCode || (flightNo.match(/^([A-Z0-9]{2})/) || [])[1] || 'XX';
  return AIRLINE_BY_CODE[prefix] || prefix;
}

function parseYmd(date: string): { year: number; month: number; day: number } {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error('Invalid date format, expected YYYY-MM-DD');
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

function formatDateDdMmYyyy(date: string): string {
  const { year, month, day } = parseYmd(date);
  return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
}

function formatDateDdSlashMmSlashYyyy(date: string): string {
  return formatDateDdMmYyyy(date).replace(/-/g, '/');
}

function toAbaySInfoDate(date: string): string {
  const { year, month, day } = parseYmd(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day}${months[month - 1]}${year}`;
}

function toIsoPlus7(date: string, hm: string, plusDays = 0): string {
  const { year, month, day } = parseYmd(date);
  const dt = new Date(Date.UTC(year, month - 1, day + plusDays));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}T${hm}:00+07:00`;
}

function durationMin(depHm: string, arrHm: string): number {
  const [dh, dm] = depHm.split(':').map(Number);
  const [ah, am] = arrHm.split(':').map(Number);
  let dep = dh * 60 + dm;
  let arr = ah * 60 + am;
  if (arr < dep) arr += 24 * 60;
  return arr - dep;
}

function isDomesticRoute(input: AbaySearchInput): boolean {
  return DOMESTIC_AIRPORTS.has(input.from.toUpperCase()) && DOMESTIC_AIRPORTS.has(input.to.toUpperCase());
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

function buildInitialFormBody($: ReturnType<typeof load>, input: AbaySearchInput): URLSearchParams {
  const body = new URLSearchParams();
  body.set('__EVENTTARGET', '');
  body.set('__EVENTARGUMENT', '');
  body.set('__VIEWSTATE', $('#__VIEWSTATE').attr('value') || '');
  body.set('__VIEWSTATEGENERATOR', $('#__VIEWSTATEGENERATOR').attr('value') || '');
  body.set('__EVENTVALIDATION', $('#__EVENTVALIDATION').attr('value') || '');
  body.set('ctl00$cphMain$ctl00$usrSearchFormD2$txtFrom', cityText(input.from));
  body.set('hdfstartplace', input.from.toUpperCase());
  body.set('ctl00$cphMain$ctl00$usrSearchFormD2$txtTo', cityText(input.to));
  body.set('hdfendplace', input.to.toUpperCase());
  body.set('ctl00$cphMain$ctl00$usrSearchFormD2$txtDepDate', formatDateDdMmYyyy(input.date));
  body.set('hdfDepartureDate', formatDateDdMmYyyy(input.date));
  body.set('txt-date-departure', formatDateDdSlashMmSlashYyyy(input.date));
  body.set('ctl00$cphMain$ctl00$usrSearchFormD2$txtRetDate', '');
  body.set('hdfReturnDate', '');
  body.set('txt-date-return', '');
  body.set('ctl00$cphMain$ctl00$usrSearchFormD2$cboAdult', String(input.adults ?? 1));
  body.set('ctl00$cphMain$ctl00$usrSearchFormD2$cboChild', String(input.children ?? 0));
  body.set('ctl00$cphMain$ctl00$usrSearchFormD2$cboInfant', String(input.infants ?? 0));
  body.set('ctl00$cphMain$ctl00$usrSearchFormD2$btnSearch', 'search');
  return body;
}

async function loadResultPage(input: AbaySearchInput): Promise<{ html: string; resultUrl: string }> {
  const homeHtml = await fetchText('https://www.abay.vn/', {
    headers: { 'user-agent': 'Mozilla/5.0', 'cookie': 'Client-Browser=1' }
  });
  const $ = load(homeHtml);
  const response = await fetch('https://www.abay.vn/', {
    method: 'POST',
    redirect: 'follow',
    body: buildInitialFormBody($, input).toString(),
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'origin': 'https://www.abay.vn',
      'referer': 'https://www.abay.vn/',
      'user-agent': 'Mozilla/5.0',
      'cookie': 'Client-Browser=1',
    },
  });
  if (!response.ok) throw new Error(`Abay POST failed with HTTP ${response.status}`);
  return { html: await response.text(), resultUrl: response.url };
}

function extractDomesticResultState(html: string, input: AbaySearchInput) {
  const $ = load(html);
  const sInfo = ($('#sInfo').text() || '').trim();
  const domain = html.match(/var\s+DOMAIN\s*=\s*'([^']+)'/)?.[1] || 'https://chuyenbay2.abay.vn';
  const searchrealout = html.match(/var\s+searchrealout\s*=\s*'([^']*)'/)?.[1] || '';
  const expectedSInfo = `${input.from.toUpperCase()}-${input.to.toUpperCase()}-${input.adults ?? 1}-${input.children ?? 0}-${input.infants ?? 0}-${toAbaySInfoDate(input.date)}-`;
  if (!sInfo) throw new Error('Abay result page missing #sInfo state');
  return { sInfo, expectedSInfo, domain, searchrealout };
}

function extractIntlState(html: string) {
  const settingsMatch = html.match(/const _SearchSettings=(\{.*?\});const _SearchInfo=/s);
  const infoMatch = html.match(/const _SearchInfo=(\{.*?\});<\/script>/s);
  if (!settingsMatch?.[1] || !infoMatch?.[1]) throw new Error('Abay international page missing search state');
  return {
    settings: JSON.parse(settingsMatch[1]) as IntlSearchSettings,
    info: JSON.parse(infoMatch[1]) as IntlSearchInfo,
  };
}

async function fetchDomesticFlightsJson(state: ReturnType<typeof extractDomesticResultState>): Promise<unknown> {
  const url = new URL('/_WEB/ResultDom2024/ResultDomAjax.aspx/GetFlights', state.domain);
  [
    ['input', state.sInfo], ['sortby', 'abay-suggest'], ['filterbyairline', ''],
    ['defaultSort', '1'], ['IsRewriteFare', '0'], ['display', 'base'], ['edition', '2'],
    ['cookieAll', '{}'], ['waytype', 'OutBound'],
    ['isAllowSearchReal', /[^0,]/.test(state.searchrealout) ? '1' : '0'],
  ].forEach(([k, v]) => url.searchParams.set(k as string, v as string));
  if (/[^0,]/.test(state.searchrealout)) url.searchParams.set('searchOutBound', state.searchrealout);
  const text = await fetchText(url.toString(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'https://www.abay.vn',
      'referer': 'https://www.abay.vn/',
      'user-agent': 'Mozilla/5.0',
    },
    body: '{}',
  });
  const payload = JSON.parse(text) as AbayAjaxResponse;
  if (!payload?.d) throw new Error('Abay flight endpoint returned empty payload');
  return JSON.parse(payload.d);
}

async function fetchIntlResultsHtml(resultUrl: string, state: ReturnType<typeof extractIntlState>): Promise<string> {
  const base = state.settings.LookupResultFromDomain || 'https://searchintd.abay.vn';
  const endpoint = `${base}/_WEB/ResultInt/ResultIntAjax.aspx/${state.settings.GetSearchResult}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-requested-with': 'XMLHttpRequest',
      'user-agent': 'Mozilla/5.0',
      'referer': resultUrl,
      'origin': 'https://www.abay.vn',
      'cookie': 'Client-Browser=1',
    },
    body: JSON.stringify({ searchInfo: JSON.stringify(state.info) }),
  });
  if (!res.ok) throw new Error(`Abay international result request failed with HTTP ${res.status}`);
  const payload = JSON.parse(await res.text()) as { d?: { ShouldRequestNew?: boolean; Content?: string } };
  const content = payload?.d?.Content || '';
  if (!content) throw new Error('Abay international result returned empty content');
  return content;
}

function normalizeDomesticFlights(data: unknown, input: AbaySearchInput): AbayFlightRow[] {
  const items: AbayFlightItem[] = Array.isArray((data as Record<string, unknown>)?.D)
    ? (data as Record<string, AbayFlightItem[]>).D
    : [];
  const cabin = input.cabin === 'business' ? 'business' : 'economy';
  const rows = items.map((item) => {
    const flightNo = String(item.F || '').trim().toUpperCase();
    const dep = String(item.G || '').trim();
    const arr = String(item.H || '').trim();
    const price = parseMoneyVnd(item.J || item.L);
    if (!flightNo || !/^\d{1,2}:\d{2}$/.test(dep) || !/^\d{1,2}:\d{2}$/.test(arr) || !price) return null;
    const depMins = Number(dep.split(':')[0]) * 60 + Number(dep.split(':')[1]);
    const overnight = durationMin(dep, arr) + depMins > 24 * 60;
    return {
      source: 'abay.vn' as const,
      airline: airlineNameFromFlightNo(flightNo, String(item.E || '').trim().toUpperCase()),
      flight_number: flightNo,
      origin_iata: input.from.toUpperCase(),
      destination_iata: input.to.toUpperCase(),
      scheduled_departure: toIsoPlus7(input.date, dep),
      scheduled_arrival: toIsoPlus7(input.date, arr, overnight ? 1 : 0),
      duration_minutes: durationMin(dep, arr),
      stops: 0,
      price,
      base_price: price,
      detail_url: item.T ? new URL(String(item.T), 'https://www.abay.vn').toString() : undefined,
      currency: 'VND' as const,
      cabinClass: cabin,
    };
  }).filter(Boolean) as AbayFlightRow[];

  const uniq = new Map<string, AbayFlightRow>();
  for (const row of rows) {
    const key = `${row.flight_number}-${row.scheduled_departure}-${row.price}`;
    if (!uniq.has(key)) uniq.set(key, row);
  }
  return [...uniq.values()].sort((a, b) => a.price - b.price);
}

function normalizeIntlFlights(contentHtml: string, input: AbaySearchInput): AbayFlightRow[] {
  const $ = load(contentHtml);
  const cabin = input.cabin === 'business' ? 'business' : 'economy';
  const rows: AbayFlightRow[] = [];

  $('.flight').each((_, el) => {
    const flight = $(el);
    const detail = flight.find('.item-details').first();
    const priceBox = flight.find('.item-block.total-price').first();
    const flightNo = detail.find('.segment-block.center code').first().text().trim().toUpperCase();
    const airline = detail.find('.segment-block.center ul li').first().text().trim() || airlineNameFromFlightNo(flightNo);
    const depTime = detail.find('.from-location').parent().find('small').first().text().trim();
    const depDateText = detail.find('.from-date').first().text().trim();
    const arrTime = detail.find('.to-location').parent().find('small').first().text().trim();
    const arrDateText = detail.find('.to-date').first().text().trim();
    const basePrice = parseMoneyVnd(priceBox.attr('data-base-price-adt'));
    const totalPrice = parseMoneyVnd(priceBox.attr('data-total-price-adt'));
    const stopsText = flight.attr('data-stop-points') || '0|';
    const stops = Math.max(0, ...stopsText.split('|').filter(Boolean).map(x => Number(x) || 0));
    const depDate = depDateText ? `${input.date.slice(0,4)}-${depDateText.slice(3,5)}-${depDateText.slice(0,2)}` : input.date;
    const arrDate = arrDateText ? `${input.date.slice(0,4)}-${arrDateText.slice(3,5)}-${arrDateText.slice(0,2)}` : depDate;
    const taxesFees = totalPrice && basePrice ? Math.max(totalPrice - basePrice, 0) : undefined;
    const bookUrl = flight.attr('data-book-url');
    const detailUrl = bookUrl ? new URL(bookUrl, 'https://www.abay.vn').toString() : undefined;
    if (!flightNo || !/^\d{1,2}:\d{2}$/.test(depTime) || !/^\d{1,2}:\d{2}$/.test(arrTime)) return;

    rows.push({
      source: 'abay.vn',
      airline,
      flight_number: flightNo,
      origin_iata: input.from.toUpperCase(),
      destination_iata: input.to.toUpperCase(),
      scheduled_departure: `${depDate}T${depTime}:00+07:00`,
      scheduled_arrival: `${arrDate}T${arrTime}:00+08:00`,
      duration_minutes: durationMin(depTime, arrTime),
      stops,
      price: totalPrice || basePrice,
      base_price: basePrice || undefined,
      taxes_fees: taxesFees,
      total_price: totalPrice || undefined,
      detail_url: detailUrl,
      currency: 'VND',
      cabinClass: cabin,
    });
  });

  const uniq = new Map<string, AbayFlightRow>();
  for (const row of rows) {
    const key = `${row.flight_number}-${row.scheduled_departure}-${row.price}`;
    if (!uniq.has(key)) uniq.set(key, row);
  }
  return [...uniq.values()].sort((a, b) => a.price - b.price);
}

export async function fetchAbayFareDetail(detailUrl: string): Promise<AbayFareBreakdown | null> {
  const html = await fetchText(detailUrl, {
    headers: { 'user-agent': 'Mozilla/5.0', 'referer': 'https://www.abay.vn/', 'cookie': 'Client-Browser=1' }
  });
  const $ = load(html);
  const paxRow = $('table.price-break tr').filter((_, el) => $(el).find('td.pax').length >= 5).first();
  if (!paxRow.length) return null;
  const cells = paxRow.find('td.pax').map((_, el) => $(el).text().trim()).get();
  if (cells.length < 5) return null;
  return {
    basePrice: parseMoneyVnd(cells[2]),
    taxesFees: parseMoneyVnd(cells[3]),
    totalPrice: parseMoneyVnd(cells[4]),
  };
}

async function searchAbayDomesticFlights(input: AbaySearchInput): Promise<AbayFlightRow[]> {
  const { html, resultUrl } = await loadResultPage(input);
  const state = extractDomesticResultState(html, input);
  if (!resultUrl.includes('/Ve-May-Bay-Gia-Re-')) throw new Error(`Abay did not redirect to result page: ${resultUrl}`);
  if (state.sInfo !== state.expectedSInfo) throw new Error(`Abay result state mismatch: got ${state.sInfo}, expected ${state.expectedSInfo}`);
  const data = await fetchDomesticFlightsJson(state);
  return normalizeDomesticFlights(data, input);
}

async function searchAbayInternationalFlights(input: AbaySearchInput): Promise<AbayFlightRow[]> {
  const { html, resultUrl } = await loadResultPage(input);
  if (!resultUrl.includes('/Ve-May-Bay-Quoc-Te-')) throw new Error(`Abay did not redirect to international result page: ${resultUrl}`);
  const state = extractIntlState(html);
  const content = await fetchIntlResultsHtml(resultUrl, state);
  return normalizeIntlFlights(content, input);
}

export async function searchAbayFlights(input: AbaySearchInput): Promise<AbayFlightRow[]> {
  if (isDomesticRoute(input)) return searchAbayDomesticFlights(input);
  return searchAbayInternationalFlights(input);
}
