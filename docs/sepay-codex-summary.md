# SePay Mức A Integration — Tóm tắt cho Codex

> **Dự án:** TanPhuAPG (Next.js 14 App Router + Prisma + PostgreSQL)
> **Ngày hoàn thành:** 2026-05-07
> **Phạm vi:** SePay QR động + Webhook biến động số dư (Mức A)

---

## Tài liệu tham khảo SePay

| # | Tài liệu | URL |
|---|---|---|
| 1 | Tổng quan tích hợp | https://docs.sepay.vn/ |
| 2 | Quickstart | https://docs.sepay.vn/quickstart.html |
| 3 | Tạo mã QR ngân hàng | https://docs.sepay.vn/tao-ma-qr-ngan-hang.html |
| 4 | Webhook biến động số dư | https://docs.sepay.vn/webhook-bien-dong-so-du.html |
| 5 | Cấu hình webhook | https://docs.sepay.vn/cau-hinh-webhook.html |
| 6 | Kết quả & payload webhook | https://docs.sepay.vn/ket-qua-webhook.html |
| 7 | Danh sách ngân hàng & mã BIN | https://docs.sepay.vn/danh-sach-ngan-hang.html |
| 8 | IP SePay & trạng thái | https://docs.sepay.vn/ip-trang-thai.html |

---

## Mục tiêu

Tích hợp SePay QR động + webhook biến động số dư vào luồng thanh toán. **Không** tạo model mới — tái sử dụng hoàn toàn `PaymentIntent` và `BankTransaction` sẵn có (từ PayOS), chỉ bổ sung enum `SEPAY`.

---

## 1. Database

### `prisma/schema.prisma`

```prisma
enum PaymentIntentProvider {
  PAYOS
  SEPAY   // ← thêm mới
}
```

### `prisma/migrations/20260506100000_phase3_sepay_provider/migration.sql`

```sql
ALTER TYPE "PaymentIntentProvider" ADD VALUE 'SEPAY';
```

> **Lưu ý:** Prisma CLI không đọc `.env.local`, cần chạy:
> ```bash
> npx dotenv -e .env.local -- npx prisma migrate deploy
> ```

---

## 2. Biến môi trường

### `.env.local`

```env
SEPAY_BANK_ACCOUNT=8869414319
SEPAY_BANK_CODE=BIDV
SEPAY_BANK_ACCOUNT_NAME=VU DUC ANH
SEPAY_QR_TEMPLATE=compact
SEPAY_WEBHOOK_API_KEY=tanphuapg-sepay-2026
SEPAY_SKIP_IP_CHECK=true          # dev only — bỏ trên production
SEPAY_TEST_URL=http://localhost:3000/api/webhooks/sepay
```

---

## 3. `lib/payments/providers/sepay.ts` _(file mới)_

Helper functions thuần (không DB):

| Function | Mô tả |
|---|---|
| `buildSepayQrUrl(input)` | Gen URL `https://qr.sepay.vn/img?acc=...&bank=...&amount=...&des=APG<code>&template=compact` |
| `buildSepayDedupeKey(payload)` | `SEPAY:<id>:<amount>` — chống replay webhook |
| `extractOrderCodeFromContent(content)` | Regex `/APG[\s_-]?(\d{6,})/i` trích `providerOrderCode` từ nội dung CK |
| `isSepayIpAllowed(ip)` | Whitelist 6 IP + bypass khi `SEPAY_SKIP_IP_CHECK=true` |
| `verifySepayAuth(headers)` | Check `Authorization: Apikey <key>` |
| `parseSepayAmount(value)` | Xử lý `number \| string` từ payload |
| `parseSepayTransactionDate(value)` | `"yyyy-mm-dd HH:MM:SS"` (UTC+7) → `Date` |

**IP whitelist mặc định** (theo docs SePay):
```
172.236.138.20
172.233.83.68
171.244.35.2
151.158.108.68
151.158.109.79
103.255.238.139
```

**Convention match:** nội dung chuyển khoản phải chứa `APG<providerOrderCode>`
_(ví dụ: `Khach hang chuyen tien APG1778083257524 cho ve may bay`)_

---

## 4. `lib/payments/sepayService.ts` _(file mới)_

### `createSepayIntentForBooking(bookingId, actorId?)`

- Kiểm tra booking tồn tại, chưa PAID, chưa CANCELLED
- Reuse intent PENDING/PARTIAL nếu còn hạn (không tạo trùng)
- Tạo `PaymentIntent` với `provider=SEPAY`
- `providerOrderCode` = `${Math.floor(Date.now()/1000)}${3-digit-random}` (13–16 chữ số, unique)
- `qrCode` = URL ảnh QR SePay, `transferContent = APG<providerOrderCode>`
- Ghi audit log, schedule reminder jobs

### `cancelSepayIntent(bookingId, intentId, actorId?)`

- Validate ownership booking ↔ intent
- Cập nhật intent → `CANCELLED`
- Audit log

### `handleSepayWebhook(payload)` — 8 nhánh

| Kind | Điều kiện | Hành động |
|---|---|---|
| `duplicate` | `dedupeKey` đã tồn tại trong DB | Return early (idempotent) |
| `ignored` | `transferType !== "in"` | Return early |
| `manual_review / ORDER_CODE_MISSING_IN_CONTENT` | Regex không match content | Tạo BankTransaction MANUAL_REVIEW |
| `manual_review / PAYMENT_INTENT_NOT_FOUND` | `providerOrderCode` không tìm thấy | Tạo BankTransaction MANUAL_REVIEW |
| `manual_review / ORDER_EXPIRED` | `booking.ttlExpiresAt` đã qua | Tạo BankTransaction MANUAL_REVIEW |
| `manual_review / PAYMENT_INTENT_ALREADY_PAID` | Intent đã PAID | Tạo BankTransaction MANUAL_REVIEW |
| `manual_review / OVERPAID` hoặc `UNDERPAID` | Số tiền không khớp `intent.amount` | Tạo BankTransaction MANUAL_REVIEW |
| `matched` | Tất cả điều kiện OK | Tạo Payment + BankTransaction MATCHED + Intent → PAID + audit + timeline event |

---

## 5. API Routes _(4 file mới)_

### `POST /api/webhooks/sepay`
`app/api/webhooks/sepay/route.ts`

```
IP check → Auth check → Parse body → handleSepayWebhook() → notify()
```

- Trả `200 { success: true }` khi OK (kể cả `manual_review`)
- Trả `500` khi exception → SePay tự retry

### `POST /api/payment/sepay/create`
`app/api/payment/sepay/create/route.ts`

```json
// Request body
{ "bookingId": "string" }

// Response
{
  "intent": {
    "qrCode": "https://qr.sepay.vn/img?...",
    "accountNumber": "8869414319",
    "accountName": "VU DUC ANH",
    "bankCode": "BIDV",
    "transferContent": "APG1778083257524",
    "amount": 2286840,
    "currency": "VND",
    "expiresAt": "2026-05-07T..."
  }
}
```

Public B2C — không cần auth session.

### `GET /api/payment/sepay/status/[bookingId]`
`app/api/payment/sepay/status/[bookingId]/route.ts`

- Polling mỗi 4s từ frontend
- Auto-expire stale intents (status → EXPIRED nếu `expiresAt` đã qua)

```json
// Response
{
  "paymentStatus": "PAID | PENDING | PARTIAL | EXPIRED",
  "balance": 0,
  "intent": { ... },
  "bookingStatus": "PAID | HELD | ...",
  "ttlExpiresAt": "2026-05-07T..."
}
```

### Admin endpoints

| Method | Path | Mô tả |
|---|---|---|
| `POST` | `/api/admin/bookings/[id]/sepay-intents` | Admin tạo QR SePay (role `PAYMENT_CAPTURE_ROLES`) |
| `DELETE` | `/api/admin/bookings/[id]/sepay-intents/[intentId]` | Admin hủy QR SePay |

---

## 6. Trang thanh toán

### `app/booking/payment/[bookingId]/page.tsx` _(file mới — Server Component)_

Fetch booking với đầy đủ thông tin:

```typescript
select: {
  id, orderCode, sessionId, status, saleAmount, currency,
  airline, routeSummary, departAt, returnAt, ttlExpiresAt,
  pnr, tripType, adt, chd, inf, namthanhRawJson,
  customer: { fullName, phone, email },
  pnrs: { airline, pnr, status, routeSummary, departAt, timelimit },
  payments: { amount, status },
  paymentIntents: { /* SEPAY, latest */ qrCode, accountNumber, ... }
}
```

Parse `namthanhRawJson` → build `PaymentItineraryLeg[]`:

```typescript
interface PaymentItineraryLeg {
  legKey: string;           // "outbound" | "inbound" | "leg-0"
  legLabel: string;         // "Chiều đi" | "Chiều về"
  airline: string | null;
  flightNumber: string | null;   // từ holdResult.flight.flightNo
  route: string;                 // "HAN-SGN"
  from: string | null;
  to: string | null;
  departureAt: string | null;
  arrivalAt: string | null;
  cabin: string | null;          // fareClass hoặc cabin
  pnr: string | null;
  pnrStatus: string | null;
  pnrTimelimit: string | null;
}
```

Data source:
- `namthanhRawJson.quote.legs[]` → `departureAt`, `arrivalAt`, `airline`, `fareClass`, `route`
- `namthanhRawJson.holdResult.flight` / `.legs.outbound.flight` / `.legs.inbound.flight` → `flightNo`
- `booking.pnrs[]` → `pnr`, `status`, `timelimit`

### `app/booking/payment/[bookingId]/SepayPaymentClient.tsx` _(file mới — Client Component)_

**Countdown `useCountdown(targetIso)`** — format đa cấp:
- `> 1 ngày`: `Dd HH:MM:SS` (ví dụ: `23n 08:42:08`)
- `> 1 giờ`: `HH:MM:SS`
- `< 1 giờ`: `MM:SS`

**Polling:** `useEffect` → `GET /api/payment/sepay/status/<bookingId>` mỗi 4s

**UI sections:**
1. **HÀNH TRÌNH** — header badge (Một chiều/Khứ hồi + HELD/TICKETED + số tiền) + booking info (orderCode, sessionId, PNR, paxLabel, SĐT) + `FlightLegRow` mỗi chặng
2. **QR THANH TOÁN** — QR image + nội dung CK + số tiền + STK + tên TK + ngân hàng + countdown

`FlightLegRow` component: badge chiều đi/về + airline + cabin + PNR badge + departure→arrival time + airport codes + timelimit warning.

---

## 7. Wire CTA "Thanh toán ngay"

### `components/HoldBookingModal.tsx` _(sửa)_

Sau khi hold thành công, thêm vào block `resultBlock`:

```tsx
{result.bookingId && (
  <div className="mt-3 rounded-lg border border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100 p-3">
    <p className="mb-2 text-xs font-medium text-emerald-800">
      Đặt chỗ thành công! Thanh toán ngay để giữ giá vé.
    </p>
    <a
      href={`/booking/payment/${result.bookingId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg
                 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
    >
      Thanh toán ngay {fmtVND(result.totalAmount)}
    </a>
  </div>
)}
```

---

## 8. Admin Dashboard

### `lib/payments/admin.ts` _(sửa)_

```typescript
// Schema: thêm provider filter
provider: z.enum(["all", "PAYOS", "SEPAY"]).default("all")

// AdminPaymentOpsIntent: thêm fields
provider: string
qrCode: string | null

// AdminPaymentOpsTransaction: thêm field
provider: string
```

`buildIntentWhere` và `buildTransactionWhere` filter theo `providerFilter`.

### `app/admin/payments/page.tsx` _(sửa)_

- Select **Provider** (Tất cả / SePay / PayOS) trong filter form
- Cột **Provider** với badge màu: emerald = SEPAY, blue = PAYOS
- Cột **Hành động**: "Xem QR" → `/booking/payment/<id>` (SEPAY) / "Mở payOS" (PAYOS)
- Heading đổi thành "Payment Intent gần đây"
- Subtitle: "Theo dõi QR SePay / PayOS, webhook và manual review."

---

## 9. Scripts

### `scripts/sepay-test-webhook.js` _(file mới)_

```bash
# Auto pick PENDING intent từ DB rồi gửi webhook giả lập
node scripts/sepay-test-webhook.js

# Manual với content và amount cụ thể
node scripts/sepay-test-webhook.js APG1778083257524 2286840
```

Build payload đúng format SePay, POST đến `SEPAY_TEST_URL` với `Authorization: Apikey <key>`.

### `scripts/sepay-debug.js` _(file mới)_

Hiển thị 5 `BankTransaction` SEPAY gần nhất với status và lý do manual_review.

---

## 10. Docs & Env

| File | Nội dung |
|---|---|
| `docs/sepay-integration.md` | Setup guide + flow diagram + go-live checklist |
| `.env.example` | Thêm 7 biến SePay có comment |

---

## Tổng hợp files thay đổi (19 files)

| File | Loại |
|---|---|
| `prisma/schema.prisma` | Sửa |
| `prisma/migrations/20260506100000_phase3_sepay_provider/migration.sql` | Mới |
| `.env.local` | Sửa |
| `.env.example` | Sửa |
| `lib/payments/providers/sepay.ts` | Mới |
| `lib/payments/sepayService.ts` | Mới |
| `lib/payments/admin.ts` | Sửa |
| `app/api/webhooks/sepay/route.ts` | Mới |
| `app/api/payment/sepay/create/route.ts` | Mới |
| `app/api/payment/sepay/status/[bookingId]/route.ts` | Mới |
| `app/api/admin/bookings/[id]/sepay-intents/route.ts` | Mới |
| `app/api/admin/bookings/[id]/sepay-intents/[intentId]/route.ts` | Mới |
| `app/booking/payment/[bookingId]/page.tsx` | Mới |
| `app/booking/payment/[bookingId]/SepayPaymentClient.tsx` | Mới |
| `components/HoldBookingModal.tsx` | Sửa |
| `app/admin/payments/page.tsx` | Sửa |
| `scripts/sepay-test-webhook.js` | Mới |
| `scripts/sepay-debug.js` | Mới |
| `docs/sepay-integration.md` | Mới |

---

## Luồng end-to-end

```
User hold booking → PNR thành công
  → HoldBookingModal hiện nút "Thanh toán ngay {amount}"
  → Redirect /booking/payment/<bookingId>
  → POST /api/payment/sepay/create
      → tạo PaymentIntent PENDING, gen QR URL
  → UI hiển thị QR ảnh + "APG1778083257524" + countdown
  → Frontend poll /api/payment/sepay/status/<bookingId> mỗi 4s

Khách chuyển khoản → SePay nhận biến động
  → POST /api/webhooks/sepay
      payload.content = "...APG1778083257524..."
      payload.transferAmount = 2286840
  → IP check (bypass dev) → Auth check
  → extractOrderCode("APG1778083257524") → providerOrderCode match
  → Tạo Payment + BankTransaction MATCHED
  → PaymentIntent → PAID
  → Frontend poll nhận paymentStatus=PAID → hiển thị xác nhận
```

---

## Kết quả test (`node scripts/sepay-test-webhook.js`)

**Payload gửi đi:**
```json
{
  "gateway": "BIDV",
  "transactionDate": "2026-05-06 16:19:56",
  "accountNumber": "8869414319",
  "transferType": "in",
  "transferAmount": 2286840,
  "content": "Khach hang chuyen tien APG1778083257524 cho ve may bay"
}
```

**Response nhận về:**
```json
{
  "success": true,
  "kind": "matched",
  "bankTransactionId": "cmou9jgxr000ok5m86531d1eb",
  "paymentIntentId": "cmou8v2ud000fk5m8unlaoq4r",
  "paymentId": "cmou9jgv6000mk5m8qc1a4bse"
}
```

---

## Production Checklist

- [ ] Thêm 6 env vars SePay vào Vercel (bỏ `SEPAY_SKIP_IP_CHECK`)
- [ ] Chạy `npx prisma migrate deploy` trên production DB
- [ ] Vào **SePay Dashboard → Cấu hình Webhook**:
  - URL: `https://tanphuapg.com/api/webhooks/sepay`
  - API Key: khớp với `SEPAY_WEBHOOK_API_KEY`
- [ ] Test bằng chức năng "Giả lập giao dịch" trên SePay dashboard
- [ ] Kiểm tra admin `/admin/payments` nhận đúng MATCHED transaction
