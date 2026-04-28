# SPRINT F.5 — Backport DateStrip vào homepage

> **Repo:** `F:\Làm việc Ai\booktanphuapg` (Next.js 14 App Router, TypeScript strict)
> **File chính cần sửa:** `app/page.tsx` (~1255 dòng — homepage `localhost:3000`)
> **Phụ thuộc:** Sprint F đã hoàn tất (đã có `<DateStrip />`, `/api/search/lowest-fare`, `lib/date.ts`).

---

## Bối cảnh

Sprint F đã xong, nhưng tích hợp date strip mới chỉ áp dụng cho route `/search` (`components/SearchResultsClient.tsx`). Homepage (`app/page.tsx`) là 1 flow riêng tự render kết quả flight inline — đây mới là trang user thực sự thấy ở `localhost:3000`.

Nhiệm vụ: chèn `<DateStrip />` vào homepage tại đúng 2 vị trí dưới card navy "CHIỀU ĐI" và "CHIỀU VỀ" (cả desktop và mobile nếu có), tái dùng cache + component đã build.

**Lưu ý quan trọng về format date:**
- `app/page.tsx` lưu `date` và `returnDate` ở định dạng **ISO `YYYY-MM-DD`** (do `<input type="date">`).
- `<DateStrip selectedDate={...}>` nhận **`YYYY-MM-DD`** và `onSelect` callback trả về **`YYYY-MM-DD`**.
- → **KHÔNG cần** `toISO()` / `formatDMY()` ở đây — pass thẳng `date` và `setDate` là được.
- Khác với `SearchResultsClient.tsx` (dùng query string DMY `01-05-2026`).

---

## Việc cần làm

### Bước 1 — Import dynamic (top of file)

Tại đầu `app/page.tsx`, thêm import dynamic component (lazy load để không tăng First Load JS):

```tsx
import dynamic from "next/dynamic";

const DateStrip = dynamic(() => import("@/components/search/DateStrip"), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-3 gap-px border-y border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={`min-h-[76px] bg-white p-3 ${
            i === 0 ? "hidden lg:block" : i === 4 ? "hidden md:block" : ""
          }`}
        >
          <div className="h-3 w-16 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-3 h-5 w-20 animate-pulse rounded-full bg-slate-200" />
        </div>
      ))}
    </div>
  ),
});
```

### Bước 2 — Chèn DateStrip vào card "Chiều đi" desktop

**Vị trí:** Sau `</div>` đóng của header navy gradient (line ~1178), TRƯỚC block `{selectedOutbound && (...)}` (line 1179).

Code hiện tại (giữ nguyên):
```tsx
<div className="px-5 py-4 text-white" style={{ background: 'linear-gradient(135deg, var(--apg-aviation-navy-deep), var(--apg-aviation-navy-mid))' }}>
  <div className="apg-display text-[11px] font-medium uppercase tracking-[0.22em] text-white/75">Chiều đi</div>
  <div className="mt-1 flex items-center justify-between">
    <div className="apg-display text-[24px] font-semibold text-white">{fromCode} → {toCode}</div>
    <div className="apg-tabular text-sm font-semibold text-white/90">{sortedOutbound.length}/{outboundResults.length}</div>
  </div>
  <div className="mt-1 text-xs text-white/80">{date}</div>
</div>
{/* ⬇⬇⬇ CHÈN DateStrip Ở ĐÂY ⬇⬇⬇ */}
{selectedOutbound && ( ... )}
```

Thêm:
```tsx
<DateStrip
  origin={fromCode}
  destination={toCode}
  selectedDate={date}
  direction="depart"
  onSelect={(nextDate) => setDate(nextDate)}
/>
```

### Bước 3 — Chèn DateStrip vào card "Chiều về" desktop

**Vị trí:** Sau `</div>` đóng của header navy "Chiều về" (line ~1205), TRƯỚC block `{selectedInbound && (...)}` (line 1206).

Thêm:
```tsx
<DateStrip
  origin={toCode}
  destination={fromCode}
  selectedDate={returnDate || toYmd(10)}
  direction="return"
  onSelect={(nextDate) => setReturnDate(nextDate)}
/>
```

> **Lưu ý:** chỉ render Strip "Chiều về" khi `tripType === 'roundtrip'`. Nếu section line 1196 đã được wrap trong điều kiện đó (kiểm tra parent), giữ nguyên. Nếu không, wrap thêm `{tripType === 'roundtrip' && <DateStrip ... />}`.

### Bước 4 — Tìm & chèn DateStrip vào mobile section (nếu có)

Section ở line 1168 mở bằng `<div className="hidden lg:grid lg:grid-cols-2 ...">` → đây là **desktop-only**. Mobile có khả năng dùng layout khác trong cùng file.

Codex cần:
1. Grep `app/page.tsx` cho pattern `apg-aviation-navy` hoặc `Chiều đi` để tìm các vị trí mobile khác.
2. Nếu tồn tại card "Chiều đi/Chiều về" cho mobile (responsive `lg:hidden`) → chèn DateStrip tương tự.
3. Nếu không có (mobile chỉ render flat list) → bỏ qua bước này, ghi chú trong commit message.

### Bước 5 — Kiểm tra refetch behavior

`app/page.tsx` đã có `useEffect` watch `date` / `returnDate` (xem line 712-716) để trigger search lại. Verify:
- Khi `setDate(nextDate)` được gọi từ DateStrip → flight list refresh tự động.
- Nếu KHÔNG tự refresh, tìm hàm trigger search (có thể là `runSearch()` / `searchFlights()` / `submit handler` trong file) và gọi thêm sau `setDate`.

---

## Acceptance criteria

- [ ] Mở `localhost:3000`, search HAN→SGN một chiều → thấy 1 DateStrip (5 cells) ngay dưới card navy "CHIỀU ĐI".
- [ ] Search HAN↔SGN khứ hồi → thấy 2 DateStrips (mỗi card 1 cái), origin/destination cards thứ 2 đảo ngược.
- [ ] Click cell ngày khác trên strip → flight list refresh, URL/state update, **`/api/search/lowest-fare` KHÔNG gọi lại** (verify Network tab DevTools).
- [ ] Đổi route HAN→SGN sang HAN→DAD → `/api/search/lowest-fare` gọi lại đúng 1 lần (cache miss cho route mới).
- [ ] Cell có giá thấp nhất trong dải hiện tại có badge **"Giá tốt"** màu vàng.
- [ ] Active cell (ngày đang chọn) có background navy + border vàng.
- [ ] Pan ◀ khi `date` = hôm nay → nút bị `disabled`.
- [ ] Nếu mobile có card navy → DateStrip cũng hiện ở mobile (responsive 3 cells).
- [ ] `npm run lint && npm run typecheck` clean.
- [ ] Bundle size: First Load JS của `/` không tăng quá +10KB gzip (do lazy-load).
- [ ] Visual khớp screenshot tham chiếu — DateStrip nằm liền dưới header navy, dùng đúng border/spacing của card.

---

## Tests

Không bắt buộc thêm unit test mới (DateStrip đã có 7+ tests ở Sprint F). Chỉ cần thêm **1 e2e Playwright test** vào `__tests__/e2e/date-strip.spec.ts`:

```ts
test("DateStrip renders on homepage and refetches only on route change", async ({ page }) => {
  let lowestFareCallCount = 0;
  await page.route("**/api/search/lowest-fare**", (route) => {
    lowestFareCallCount += 1;
    route.continue();
  });

  await page.goto("/");
  // Search HAN → SGN one-way, click "Tìm vé"
  // ... (reuse existing search interaction helpers)

  await expect(page.getByLabel("Giá theo ngày chiều đi")).toBeVisible();
  expect(lowestFareCallCount).toBe(1);

  // Click 1 ngày khác trong strip
  await page.getByRole("button", { name: /29\/4/ }).click();
  await page.waitForLoadState("networkidle");
  expect(lowestFareCallCount).toBe(1); // ← KHÔNG re-fetch

  // Đổi điểm đến sang DAD, search lại
  // ...
  expect(lowestFareCallCount).toBe(2); // ← Cache miss cho route mới
});
```

---

## Stop-gate

Dừng lại nếu:
- Visual không khớp (DateStrip bị overflow / sai border / chèn nhầm chỗ).
- Click ngày → flight list không refresh (chứng tỏ `setDate` không trigger search → cần fix bước 5).
- `/api/search/lowest-fare` bị gọi nhiều lần khi click ngày trong cùng route (chứng tỏ cache không hoạt động).

---

## Output deliverable

PR title:
```
feat(home): backport DateStrip into homepage outbound/inbound cards (Sprint F.5)
```

Body PR:
- Tóm tắt: thêm DateStrip vào 2 vị trí trong `app/page.tsx`, tái dùng component và cache đã có từ Sprint F.
- Screenshot before/after (homepage).
- Bundle size delta (`/`).
- Note nếu mobile section không tồn tại / không cần chèn.
