# Tích hợp thanh toán SePay — Mức A (QR động + Webhook)

## Tổng quan

SePay là middleware đối soát biến động số dư ngân hàng (BIDV, Vietcombank, MB, ACB, Techcombank, …). Nó **không giữ tiền hộ** mà đọc giao dịch từ tài khoản ngân hàng của bạn và đẩy webhook về website.

**Mức A** trong dự án này:
- Gen QR động `https://qr.sepay.vn/img?...` cho mỗi PaymentIntent.
- Khách quét QR app ngân hàng → CK đúng số tiền + nội dung `APG<orderCode>`.
- SePay đọc biến động số dư → đẩy webhook về `/api/webhooks/sepay`.
- Hệ thống match `content` regex `APG(\d+)` ↔ `PaymentIntent.providerOrderCode` → tự động đối soát.

## Kiến trúc

```
┌────────────┐  POST /api/payment/sepay/create   ┌──────────────────┐
│  Frontend  │ ────────────────────────────────► │ sepayService.ts  │
└────────────┘                                    │  createIntent    │
       │                                          └────────┬─────────┘
       │  GET /booking/payment/[bookingId]                 │
       │     (page hiển thị QR + countdown)                ▼
       │                                          ┌──────────────────┐
       │  Polling /api/payment/sepay/status      │  PaymentIntent   │
       │ ◄──────────────────────────────────────│  (provider=SEPAY)│
       │                                         └──────────────────┘
       │                                                   ▲
       ▼                                                   │
┌────────────┐                                             │
│ Khách quét │  CK → Ngân hàng → SePay đọc biến động số dư │
│ QR + CK    │                                             │
└────────────┘                                             │
                                                           │
       SePay POST  /api/webhooks/sepay                     │
       ─────────────────────────────► [handleSepayWebhook] │
                                          │                │
                                          ├─ create Payment + BankTransaction
                                          ├─ update PaymentIntent.status
                                          └─ trigger ticketing flow
```

## File mới được thêm

| File | Vai trò |
|---|---|
| `prisma/migrations/20260506100000_phase3_sepay_provider/migration.sql` | Thêm `SEPAY` vào `PaymentIntentProvider` enum |
| `lib/payments/providers/sepay.ts` | URL builder qr.sepay.vn, IP whitelist, auth verify, parse helpers |
| `lib/payments/sepayService.ts` | `createSepayIntentForBooking`, `cancelSepayIntent`, `handleSepayWebhook` |
| `app/api/webhooks/sepay/route.ts` | Endpoint nhận webhook (IP + auth + idempotency) |
| `app/api/payment/sepay/create/route.ts` | Public endpoint tạo QR cho khách lẻ |
| `app/api/payment/sepay/status/[bookingId]/route.ts` | Polling endpoint |
| `app/api/admin/bookings/[id]/sepay-intents/route.ts` | Admin tạo QR |
| `app/api/admin/bookings/[id]/sepay-intents/[intentId]/route.ts` | Admin huỷ QR |
| `app/booking/payment/[bookingId]/page.tsx` | Trang hiển thị QR + countdown |
| `app/booking/payment/[bookingId]/SepayPaymentClient.tsx` | UI client component |

## Cấu hình

### 1. Đăng ký SePay

1. Truy cập https://my.sepay.vn → đăng ký tài khoản.
2. **Liên kết tài khoản ngân hàng**: dùng Internet Banking BIDV/VCB/MB/ACB/TCB. SePay sẽ kết nối qua app banking để đọc biến động số dư.
3. Lấy thông tin: số tài khoản, mã ngân hàng (xem danh sách tại `https://qr.sepay.vn/banks.json`).

### 2. Tạo Webhook trên dashboard SePay

| Trường | Giá trị |
|---|---|
| Tên webhook | TanPhuAPG Production |
| Sự kiện | Có tiền vào |
| Tài khoản | Chọn TK đã liên kết |
| URL callback | `https://tanphuapg.com/api/webhooks/sepay` |
| Chứng thực | API Key |
| API Key | Tự đặt (chuỗi ngẫu nhiên 32+ ký tự) |

Copy API Key vào env `SEPAY_WEBHOOK_API_KEY`.

### 3. Cấu hình `.env`

```bash
SEPAY_BANK_ACCOUNT=0123456789           # Số TK đã liên kết SePay
SEPAY_BANK_CODE=BIDV                    # Mã ngân hàng (xem banks.json)
SEPAY_BANK_ACCOUNT_NAME=CTY TAN PHU APG # Tên chủ TK (hiển thị trong QR)
SEPAY_QR_TEMPLATE=compact               # compact | compact2 | qronly | print
SEPAY_WEBHOOK_API_KEY=<paste from SePay dashboard>
SEPAY_WEBHOOK_IPS=                      # Để trống = dùng default
SEPAY_SKIP_IP_CHECK=false               # true khi dev local
```

### 4. Apply migration

```bash
npx prisma migrate deploy
npx prisma generate
```

### 5. Test webhook (dev)

Tài khoản Demo SePay có nút "+ Giả lập giao dịch" cho phép test webhook mà không cần CK thật. Liên hệ SePay để được cấp tài khoản demo.

Khi dev local, dùng `ngrok` hoặc `cloudflared` để expose `localhost:3000/api/webhooks/sepay` ra internet:

```bash
ngrok http 3000
# Copy URL https://abc123.ngrok.app/api/webhooks/sepay vào webhook SePay
```

Set `SEPAY_SKIP_IP_CHECK=true` khi test local nếu IP từ ngrok không match whitelist.

## Flow tích hợp

### Khách lẻ B2C (recommended cho trang chủ)

1. User chọn vé → POST `/api/booking/hold` → Booking HELD + ttlExpiresAt (30-60 phút).
2. Redirect `/booking/payment/<bookingId>` (trang vừa tạo).
3. Trang tự gọi `POST /api/payment/sepay/create` → tạo PaymentIntent + QR URL.
4. Hiển thị QR + thông tin CK + countdown timer.
5. Frontend polling `GET /api/payment/sepay/status/<bookingId>` mỗi 4s.
6. Khách CK → SePay webhook → handler match → PaymentIntent.status = PAID.
7. Polling phát hiện status = PAID → hiển thị "Thanh toán thành công".
8. (Tương lai) Auto-trigger `/api/booking/issue-ticket` khi PAID.

### Admin tạo QR thủ công

Trong trang `/admin/bookings/<id>` (đã có sẵn), thêm nút "Tạo QR SePay" gọi:

```ts
fetch(`/api/admin/bookings/${bookingId}/sepay-intents`, { method: "POST" })
```

Để huỷ:
```ts
fetch(`/api/admin/bookings/${bookingId}/sepay-intents/${intentId}`, { method: "DELETE" })
```

## Logic match webhook

```
SePay payload:
{
  id: 12345,
  transferType: "in",
  transferAmount: 1500000,
  content: "Thanh toan APG1737000000123 cho ve may bay",
  ...
}

Handler:
  1. dedupeKey = "SEPAY:12345:1500000" → check BankTransaction tồn tại → return DUPLICATE
  2. transferType !== "in" → IGNORED
  3. Trích "APG1737000000123" từ content → providerOrderCode = "1737000000123"
  4. Tìm PaymentIntent(provider=SEPAY, providerOrderCode="1737000000123")
     - Không thấy → MANUAL_REVIEW (PAYMENT_INTENT_NOT_FOUND)
  5. Booking expired → MANUAL_REVIEW (ORDER_EXPIRED) + intent.status=EXPIRED
  6. So sánh transferAmount với remaining:
     - = expected → PAID
     - < expected → PARTIAL
     - > expected → MANUAL_REVIEW (OVERPAID)
  7. Tạo Payment + BankTransaction(MATCHED) + audit log + timeline event
  8. Cancel pending notification jobs
```

## Mã hoá nội dung CK

- Convention: `APG<providerOrderCode>` (ví dụ `APG1737000000123`).
- `providerOrderCode` được generate dạng `<unixTime><3-digit-random>` để unique.
- Regex match: `/APG[\s_-]?(\d{6,})/i` — chấp nhận `APG 123`, `APG_123`, `APG-123`.

## Bảo mật

| Lớp | Cơ chế |
|---|---|
| Network | IP whitelist (6 IP SePay default) |
| Auth | Header `Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>` |
| Replay | `BankTransaction.dedupeKey` unique theo `id` giao dịch |
| Race | `prisma.$transaction` quanh toàn bộ logic match |
| Amount tampering | So sánh strict với `PaymentIntent.amount` |

## Vấn đề đã biết & roadmap

- [ ] Mức A: nếu khách CK sai nội dung → manual review. Nâng cấp lên **Mức B (VA theo đơn hàng)** để match qua `subAccount` thay vì `content`.
- [ ] Cron đối soát ngược `GET https://my.sepay.vn/userapi/transactions/list` mỗi 5 phút (phòng webhook fail). Cần OAuth2 client.
- [ ] Tự động trigger ticketing flow khi `PaymentIntent.status = PAID` (hiện đang phải admin click thủ công).
- [ ] Auto-refund khi PNR hết hạn nhưng tiền đã về.
- [ ] Dashboard `/admin/bank-transactions` filter `status=MANUAL_REVIEW` để rà giao dịch lệch.

## Test checklist trước khi go-live

- [ ] Migration chạy thành công ở staging.
- [ ] `SEPAY_BANK_ACCOUNT` + `SEPAY_BANK_CODE` đã set ở Vercel env.
- [ ] Webhook URL trên dashboard SePay = URL production thật (không phải ngrok).
- [ ] `SEPAY_WEBHOOK_API_KEY` ở Vercel env trùng với key trên SePay dashboard.
- [ ] Test 1 giao dịch giả lập → nhận webhook → BankTransaction status MATCHED.
- [ ] Test 1 giao dịch sai nội dung → BankTransaction status MANUAL_REVIEW.
- [ ] Test polling: status đổi từ PENDING → PAID trong 4-8s sau khi webhook về.
- [ ] Kiểm tra timeline event xuất hiện ở `/admin/bookings/<id>`.
- [ ] Kiểm tra notification `INTERNAL_ALERT` được tạo (Slack/Telegram).
