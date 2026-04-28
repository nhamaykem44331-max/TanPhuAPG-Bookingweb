# SPRINT F — Date Strip cho trang Search Results

> **Repo chính:** `F:\Làm việc Ai\booktanphuapg` (Next.js 14 App Router, TypeScript strict)
> **Repo backend:** `F:\Làm việc Ai\namthanh-auto update claude\namthanh-auto-login` (Express + Playwright + Muadi proxy)
> **Trang đích:** `/search` (component `components/SearchResultsClient.tsx`)
> **Mục tiêu:** Khi user search HAN→SGN ngày 26/04/2026, ngay dưới card "CHIỀU ĐI" (header navy) sẽ hiện 1 dải ngày ±2 ngày kèm giá thấp nhất cho từng ngày. Click vào 1 ngày → đổi ngày tìm kiếm và làm mới danh sách chuyến bay (KHÔNG re-fetch lại date strip nếu cùng route).

---

## Bối cảnh kỹ thuật (đã reverse-engineer từ booking.namthanh.vn)

Nam Thanh dùng đúng 1 endpoint duy nhất: **`POST booking/search-lowest-fare`** trên Muadi gateway, body chỉ gồm `{ currencyCode, originCode, destinationCode }` — KHÔNG có `date` parameter. Response trả về toàn bộ các ngày có giá cho route đó, gom theo key `"M-YYYY"`:

```json
{
  "depart": {
    "4-2026": [
      { "day": 25, "month": 4, "year": 2026, "fareAmount": 2469000, "fareDisplay": "2.469.000 ₫" },
      { "day": 26, "month": 4, "year": 2026, "fareAmount": 1790000, "fareDisplay": "1.790.000 ₫" }
    ],
    "5-2026": [ ... ]
  },
  "return": { ... }
}
```

Frontend Nam Thanh:
- Gọi endpoint này 1 lần khi mount, lưu vào RTK Query cache (key = `${origin}-${destination}`).
- Date strip là 1 **slice view** (lấy 6 ngày xung quanh ngày đang chọn) lên dữ liệu đã cache → click ngày KHÔNG re-fetch.
- Pan ◀▶ chỉ shift `selectedDate` ±1 ngày, vẫn lookup từ cùng cache.

→ Sprint F bê nguyên tắc này về APG: **1 lần fetch, cache theo route, slice view 5 ngày (±2 ngày).**

---

## GATE F0 — Backend route `/flights/lowest-fare` (namthanh-auto-login)

**Repo:** `F:\Làm việc Ai\namthanh-auto update claude\namthanh-auto-login`

**Việc cần làm:**

1. Trong `src/muadi-client.js`, thêm method:
   ```js
   async searchLowestFare({ origin, destination, currencyCode = 'VND' }) {
     return this.post('booking/search-lowest-fare', {
       currencyCode,
       originCode: String(origin).trim().toUpperCase(),
       destinationCode: String(destination).trim().toUpperCase(),
     });
   }
   ```

2. Tạo route mới `src/routes/lowest-fare.js`:
   - Path: `GET /flights/lowest-fare?origin=HAN&destination=SGN`
   - Validate IATA 3 ký tự cho cả `origin` và `destination`. Sai format → 400 `{ error: 'INVALID_IATA' }`.
   - Cache in-memory `Map<string, { data, expiresAt }>`, key = `${origin}-${destination}`, TTL 5 phút. Cache hit → trả ngay, log `[lowest-fare] cache hit`.
   - Cache miss → gọi `client.searchLowestFare(...)`. Lỗi từ Muadi → 502 `{ error: 'UPSTREAM_ERROR', detail: ... }`.
   - Response shape gửi cho APG BFF:
     ```json
     {
       "route": { "origin": "HAN", "destination": "SGN" },
       "depart": { "4-2026": [...], "5-2026": [...] },
       "return": { ... },
       "currency": "VND",
       "cachedAt": "2026-04-25T01:24:59.611Z",
       "ttlSeconds": 300
     }
     ```
   - Kèm header `Cache-Control: private, max-age=60`.

3. Mount route trong `src/server.js`: `app.use('/flights', require('./routes/lowest-fare'))`.

4. **Tests** (`tests/lowest-fare.test.js`, dùng Jest + supertest, mock `MuadiApiClient`):
   - ✅ GET với origin/destination hợp lệ → 200 + body có `depart`, `route`, `cachedAt`.
   - ✅ Gọi 2 lần liên tiếp cùng route trong < 5 phút → lần 2 không gọi Muadi (verify mock được gọi đúng 1 lần).
   - ✅ IATA sai format (`HA`, `HANN`, ký tự đặc biệt) → 400 `INVALID_IATA`.
   - ✅ Muadi throw → 502 `UPSTREAM_ERROR`.

**Stop-gate F0:** dừng lại nếu `npm test -- lowest-fare` không pass 4/4. Không sang F1.

---

## GATE F1 — BFF route `/api/search/lowest-fare` (booktanphuapg)

**Repo:** `F:\Làm việc Ai\booktanphuapg`

**Việc cần làm:**

1. Trong `lib/namthanh.ts`, thêm helper:
   ```ts
   export async function getNamThanhLowestFare(params: {
     origin: string;
     destination: string;
   }): Promise<NamThanhLowestFareResponse> {
     const url = new URL('/flights/lowest-fare', NAMTHANH_BACKEND_URL);
     url.searchParams.set('origin', params.origin);
     url.searchParams.set('destination', params.destination);
     return namThanhFetch<NamThanhLowestFareResponse>(url.toString());
   }
   ```
   Định nghĩa type `NamThanhLowestFareResponse`, `LowestFareDay` ở cùng file (export ra ngoài).

2. Tạo route `app/api/search/lowest-fare/route.ts`:
   - Method `GET`, query `?from=HAN&to=SGN`.
   - Auth: phải có session Auth.js (cùng pattern với `/api/search`).
   - Rate limiter: dùng cùng pattern Map<userId, {count, resetAt}>, ngưỡng **30 req/h prod, 200/min dev** (date strip nhẹ hơn full search).
   - Validate IATA bằng `isValidIATA` từ `@/lib/utils`.
   - Gọi `getNamThanhLowestFare({ origin: from, destination: to })`.
   - Response: forward nguyên `depart` / `return` / `currency` / `cachedAt`, thêm `serverNow: new Date().toISOString()` để DateStrip biết clock skew.
   - Lỗi backend → 502 `{ error: 'BACKEND_UNAVAILABLE' }`.

3. **Tests** (`__tests__/api/lowest-fare.test.ts`):
   - ✅ Unauthenticated → 401.
   - ✅ Authenticated + IATA hợp lệ + backend mock OK → 200 + body có `depart`.
   - ✅ IATA sai → 400.
   - ✅ Backend trả 502 → forward 502.
   - ✅ Vượt rate limit → 429.

**Stop-gate F1:** dừng nếu `npm test -- lowest-fare` không pass 5/5.

---

## GATE F2 — Component `<DateStrip />` (booktanphuapg)

**File:** `components/search/DateStrip.tsx` + CSS module hoặc Tailwind classes inline.

### Visual spec (theo screenshot Nam Thanh + design token APG)

```
┌─────────────────────────────────────────────────────────────┐
│ ◀  T7 25/4    CN 26/4    T2 27/4    T3 28/4    T4 29/4   ▶ │
│    2.469K     1.790K     2.150K     1.890K     2.000K       │
│              [GIÁ TỐT]                                       │
└─────────────────────────────────────────────────────────────┘
                ▲ active = navy bg + gold border
```

**Token mapping (đọc từ `app/admin/styles/admin-tokens.css` hoặc design system APG):**
- Background strip: `bg-[var(--apg-bg-surface)]`
- Active cell: `bg-[var(--apg-aviation-navy)] text-white border-[var(--apg-brand-gold)]`
- Cell thường: `border border-[var(--apg-border-default)] hover:border-[var(--apg-brand-gold)]`
- Giá: `font-[var(--font-admin-mono)]` (JetBrains Mono), format `vi-VN` rút gọn (`1.79M` hoặc `1.790K` — chốt **K** để khớp với screenshot Nam Thanh).
- Badge "GIÁ TỐT": `bg-[var(--apg-brand-gold)] text-[var(--apg-aviation-navy)]`, hiện trên cell có `fareAmount` thấp nhất trong dải đang xem.

### Props

```ts
interface DateStripProps {
  origin: string;          // "HAN"
  destination: string;     // "SGN"
  selectedDate: string;    // "2026-04-26" (ISO yyyy-mm-dd)
  direction: 'depart' | 'return';
  onSelect: (date: string) => void;
  className?: string;
}
```

### Hành vi

1. **Fetch 1 lần khi `(origin, destination)` thay đổi** — dùng SWR hoặc `useEffect` + AbortController. URL: `/api/search/lowest-fare?from=${origin}&to=${destination}`.
2. **Lưu cache cục bộ** trong component (`useRef` + `Map`) hoặc dùng `useSWR` với key `lowest-fare:${origin}:${destination}` và `revalidateOnFocus: false`, `dedupingInterval: 5 * 60 * 1000`.
3. **Slice view**: lấy 5 ngày `[D-2, D-1, D, D+1, D+2]` quanh `selectedDate`. Nếu ngày nào không có trong cache → render cell `—` disabled.
4. **Click cell** → gọi `onSelect(newDate)`. KHÔNG re-fetch lowest-fare. Chỉ trigger search lại bên ngoài.
5. **Pan ◀▶** → shift selected ±1 ngày, gọi `onSelect`. Disable ◀ nếu `D-1` < hôm nay (timezone Asia/Ho_Chi_Minh).
6. **Loading**: skeleton 5 ô grey shimmer (≤ 280ms cho cảm giác snappy, không spinner to).
7. **Error**: collapse strip → render fallback string `"Không lấy được giá theo ngày"` cỡ nhỏ, có nút "Thử lại".
8. **Responsive**:
   - `≥ lg` (1024px): 5 cells + 2 nút pan, full width strip.
   - `md` (768–1023px): 4 cells (D-1, D, D+1, D+2), 2 nút pan.
   - `< md`: 3 cells (D-1, D, D+1), nút pan thu gọn icon-only.

### Tests (`__tests__/components/DateStrip.test.tsx`, RTL + jest)

- ✅ Mount với route hợp lệ → fetch đúng 1 lần, render 5 cells khi response trả đủ.
- ✅ Click cell ngày khác → `onSelect` được gọi với ngày đó, **fetch không gọi lại**.
- ✅ Đổi `origin` hoặc `destination` → fetch lại 1 lần nữa.
- ✅ `fareAmount` thấp nhất → cell đó có badge "GIÁ TỐT".
- ✅ Pan ◀ khi `selectedDate` = hôm nay → nút bị `disabled`.
- ✅ Response không có ngày `D+2` → cell đó render `—` và `aria-disabled=true`.
- ✅ Backend lỗi → render fallback "Không lấy được giá theo ngày" + button "Thử lại" gọi lại fetch.

**Stop-gate F2:** dừng nếu test không pass 7/7 hoặc visual snapshot lệch khỏi screenshot tham chiếu.

---

## GATE F3 — Tích hợp vào `SearchResultsClient.tsx`

**File:** `components/SearchResultsClient.tsx`.

### Trước Sprint F (lines 82-87)

```tsx
<header>
  {payload.from} → {payload.to} | {payload.date}
</header>
```

### Sau Sprint F

```tsx
<section className="rounded-xl border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] overflow-hidden">
  {/* Card navy giống screenshot */}
  <div className="bg-[var(--apg-aviation-navy)] text-white px-4 py-3 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--apg-brand-gold)]">
        Chiều đi
      </span>
      <span className="text-base font-semibold">
        {payload.from} → {payload.to}
      </span>
      <span className="text-sm opacity-80">{payload.date}</span>
    </div>
    <span className="font-mono text-sm">
      {filteredCount}/{totalCount}
    </span>
  </div>

  {/* Date strip ngay dưới */}
  <DateStrip
    origin={payload.from}
    destination={payload.to}
    selectedDate={toISO(payload.date)}
    direction="depart"
    onSelect={(newDate) => {
      router.replace(
        `/search?from=${payload.from}&to=${payload.to}&date=${formatDMY(newDate)}&...`
      );
    }}
  />
</section>

{/* Nếu là roundtrip thì thêm card "CHIỀU VỀ" tương tự */}
{payload.returnDate && (
  <section className="mt-4 ...">
    <div className="bg-[var(--apg-aviation-navy)] ...">CHIỀU VỀ ...</div>
    <DateStrip
      origin={payload.to}
      destination={payload.from}
      selectedDate={toISO(payload.returnDate)}
      direction="return"
      onSelect={...}
    />
  </section>
)}
```

### Việc cần làm

1. Tạo helper `lib/date.ts`:
   - `toISO(dmy: string): string` — `"26-04-2026"` → `"2026-04-26"`.
   - `formatDMY(iso: string): string` — `"2026-04-26"` → `"26-04-2026"`.
   - Test 4 case (`__tests__/lib/date.test.ts`).

2. Refactor `SearchResultsClient`:
   - Import `DateStrip` (lazy `dynamic(() => import('./search/DateStrip'), { ssr: false, loading: () => <Skeleton /> })` để giảm bundle).
   - Tách header navy thành component nội bộ `<RouteHeaderCard direction="depart"|"return" />` để tái dùng cho roundtrip.
   - `onSelect` dùng `router.replace` (không `push`) để không spam history khi user chọc thử nhiều ngày.
   - Khi `date` thay đổi qua URL → re-run `/api/search` (đã có sẵn cơ chế trong file).

3. **Tests** (`__tests__/components/SearchResultsClient.test.tsx`):
   - ✅ One-way: render đúng 1 card "CHIỀU ĐI" + 1 DateStrip.
   - ✅ Roundtrip: render 2 cards + 2 DateStrips, origin/destination của card thứ 2 đảo ngược.
   - ✅ Click ngày trong DateStrip → `router.replace` được gọi với URL mới đúng format.

**Stop-gate F3:** dừng nếu visual không khớp screenshot navy header (xem `docs/screenshots/sprint-F-target.png` user gửi) hoặc test < 3/3.

---

## GATE F4 — End-to-end integration test

**File:** `__tests__/e2e/date-strip.spec.ts` (Playwright).

5 scenarios bắt buộc:

1. **Single fetch verification:** Search HAN→SGN. Mở DevTools Network. Verify `/api/search/lowest-fare` được gọi **đúng 1 lần** (kể cả khi click 3 ngày khác nhau trên strip).
2. **No re-fetch on day click:** Click cell `D+1` → URL đổi, `/api/search` được gọi lại, nhưng `/api/search/lowest-fare` vẫn = 1 request total.
3. **Re-fetch on route change:** Đổi origin từ HAN sang DAD → `/api/search/lowest-fare` được gọi thêm 1 lần (total = 2).
4. **Roundtrip:** Search HAN↔SGN. Verify 2 DateStrips render, 2 calls `/api/search/lowest-fare` (1 cho HAN→SGN, 1 cho SGN→HAN).
5. **Backend down:** Stub `/api/search/lowest-fare` → 502. Verify fallback "Không lấy được giá theo ngày" hiển thị, button "Thử lại" hoạt động (thêm 1 request khi click).

**Stop-gate F4:** dừng nếu < 5/5 scenarios pass.

---

## Tổng acceptance Sprint F

- [ ] **F0**: backend route + 4 unit tests pass.
- [ ] **F1**: BFF route + 5 unit tests pass.
- [ ] **F2**: `<DateStrip />` component + 7 RTL tests pass + visual khớp screenshot.
- [ ] **F3**: integration vào `SearchResultsClient.tsx` + 3 tests pass + helper `lib/date.ts` + 4 tests pass.
- [ ] **F4**: 5/5 e2e scenarios pass trên Playwright.
- [ ] **Lint + typecheck**: `npm run lint && npm run typecheck` clean ở cả 2 repo.
- [ ] **Bundle size**: `<DateStrip />` lazy-loaded, không tăng First Load JS của `/search` quá +8KB gzip.
- [ ] **Lighthouse**: TBT trên `/search` không tăng quá +50ms so với baseline.

---

## Tech debt theo dõi (KHÔNG làm trong Sprint F)

- ⏭ Replace in-memory cache backend bằng Redis (cần khi scale > 1 instance).
- ⏭ Fetch thêm tháng khi user pan ra biên (hiện tại Muadi đã trả nhiều tháng nên chưa cần).
- ⏭ Service Worker offline cache cho lowest-fare (giúp PWA mode).
- ⏭ Pre-fetch lowest-fare từ trang search form (giảm cảm giác trễ trên `/search`).
- ⏭ Sprint G — `PriceSnapshot` table để bắn alert khi giá tụt.

---

## Lưu ý đặc biệt

1. **Tôn trọng rate limit Muadi**: cache TTL 5 phút ở backend là bắt buộc. Đừng giảm xuống dưới 60s vì Muadi có thể block IP.
2. **Timezone**: tất cả so sánh ngày dùng `Asia/Ho_Chi_Minh` (UTC+7). Dùng `date-fns-tz` (đã có trong `package.json`), KHÔNG dùng `new Date()` trực tiếp cho logic so sánh.
3. **Format giá**: dùng K-suffix (`1.790K`) cho cell, full format (`1.790.000 ₫`) chỉ trong tooltip on hover.
4. **A11y**:
   - Mỗi cell: `role="button"`, `aria-pressed={isSelected}`, `aria-label="Thứ 7, 25 tháng 4 2026, giá 2.469.000 đồng"`.
   - Pan buttons: `aria-label="Ngày trước đó"` / `"Ngày kế tiếp"`.
   - Keyboard: `←` / `→` dịch focus giữa cells, `Enter` chọn.
5. **Loading skeleton** dùng cùng pattern với `LoadingSkeleton.tsx` đã có để đồng bộ.
6. **Đọc kỹ** `components/SearchResultsClient.tsx` (đã có 122 dòng) trước khi sửa — không phá vỡ filter sidebar, sort bar, contact modal hiện có.

---

## Output deliverable

Sau khi xong toàn bộ 5 gates, tạo PR với title:

```
feat(search): add date strip with single-fetch lowest fare cache (Sprint F)
```

Body PR:
- Tóm tắt cơ chế (1 fetch / route, slice view, no re-fetch on click).
- Screenshots before/after.
- Bundle size delta.
- Test coverage report (cả 2 repo).

---

**Bắt đầu từ Gate F0. Mỗi gate xong, dừng lại cho user review trước khi sang gate kế.**
