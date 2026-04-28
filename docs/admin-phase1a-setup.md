# Admin Panel Phase 1a Setup

## 1. Chuẩn bị Supabase

1. Tạo một project Supabase Postgres mới.
2. Vào `Project Settings` -> `Database`.
3. Copy 2 connection string:
   - `Connection pooling` dùng cho `DATABASE_URL`, port phải là `6543` và giữ `?pgbouncer=true&connection_limit=1`.
   - `Direct connection` dùng cho `DIRECT_URL`, port phải là `5432`.

## 2. Cập nhật `.env.local`

Thêm đầy đủ các biến sau:

```env
DATABASE_URL="postgresql://postgres.xxxxx:PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.xxxxx:PASSWORD@aws-0-region.pooler.supabase.com:5432/postgres"
NEXTAUTH_SECRET="chuỗi random 32 byte"
NEXTAUTH_URL="http://localhost:3000"
SEED_SUPER_ADMIN_EMAIL="admin@tanphuapg.com"
SEED_SUPER_ADMIN_PASSWORD="ChangeMeImmediately!2026"
SEED_SUPER_ADMIN_NAME="Super Admin"
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
```

`UPSTASH_REDIS_*` có thể để trống ở Sprint A. Khi đó login rate limit sẽ fallback sang bảng `RateLimitHit`.

## 3. Generate Prisma Client

Chạy:

```bash
npx prisma generate
```

## 4. Tạo schema trên database

Chạy migrate đầu tiên:

```bash
npx prisma migrate dev --name init_phase1a
```

Nếu đang dùng Supabase mới hoàn toàn, đây là lệnh sẽ tạo toàn bộ bảng nền tảng của Phase 1a.

## 5. Seed Super Admin

Chạy:

```bash
npx prisma db seed
```

Seed sẽ:

- tạo `Super Admin` đầu tiên nếu bảng `User` còn rỗng;
- đảm bảo có 2 `MarkupRule` mẫu cho Phase 1a;
- không log mật khẩu ra terminal.

## 6. Test login

1. Chạy `npm run dev`.
2. Mở `http://localhost:3000/admin/login`.
3. Đăng nhập bằng `SEED_SUPER_ADMIN_EMAIL` và `SEED_SUPER_ADMIN_PASSWORD`.
4. Sau khi đăng nhập thành công, hệ thống sẽ chuyển vào `/admin`.
5. Thử nhập sai 6 lần liên tiếp để xác nhận rate limit và thông báo tiếng Việt.

## 7. Ghi chú triển khai

- Prisma seed đang dùng `node --experimental-strip-types prisma/seed.ts` để tránh cài thêm `ts-node` hoặc `tsx`.
- Cookie session admin dùng tên riêng trong production: `__Host-admin-session`.
- Public routes như `/`, `/api/search`, `/api/booking/hold` không nằm trong matcher của middleware admin.

## 8. Markup Engine

- Markup engine nằm ở `lib/pricing/markupEngine.ts`.
- Rule match theo `priority DESC`, sau đó tie-break bằng `createdAt ASC`.
- Các field đang được support trong Sprint B: `scope`, `airline`, `channel`, `cabin`, `paxType`, `domesticInternational`, `routeFrom`, `routeTo`, `markupType`, `markupValue`, `serviceFee`, `active`.
- Test unit chạy bằng:

```bash
npm run test
```

## 9. Hold pipeline

- Gate B3 đã refactor `POST /api/booking/hold` theo pipeline: validate -> re-quote qua `POST /flights/price` -> so delta giá -> hold thật -> persist `Customer`, `Booking`, `BookingPnr`, `BookingTimelineEvent`, `AuditLog`.
- `quoteService` giữ nguyên `lib/namthanh.ts` ở vai trò net-only client, không nhúng markup vào upstream wrapper.
- Hold thật hiện yêu cầu session admin. Nhánh `dryRun=true` vẫn cho phép preview giá để tương thích với flow FE hiện tại.
- Booking list cơ bản đã mở ở `/admin/bookings` và `GET /api/admin/bookings`.

## 10. Booking lifecycle, Payment, Customer và Merge

- Sprint C mở lifecycle nội bộ cho booking: ghi nhận payment thủ công, xuất vé record-only, hủy booking và refund record-only. Các thao tác này không gọi gateway thanh toán, không gọi nhà cung cấp để refund/issue thật, và đều ghi `AuditLog`.
- Payment manual tạo record `Payment` với `PAID` hoặc `PARTIAL`; refund dùng convention amount âm với `status=REFUNDED`. `paymentSummary` cộng `PAID`/`PARTIAL` và cộng thêm record `REFUNDED` âm để trừ đúng tổng đã thu.
- Module khách hàng nằm ở `/admin/customers`, API tương ứng là `GET/POST /api/admin/customers`, `GET/PATCH /api/admin/customers/:id` và `POST /api/admin/customers/:id/merge`.
- Blacklist khách hàng không xóa dữ liệu. Toggle blacklist cập nhật `Customer.blacklisted` và lưu metadata trong `tags`: `blacklistReason`, `blacklistedAt`, `blacklistedBy`.
- Merge duplicate không tạo migration mới. Hồ sơ bị merge được đánh dấu `blacklisted=true`, lưu `tags.mergedIntoId`, `tags.mergedAt`, `tags.mergedBy`, và toàn bộ `Booking.customerId` được chuyển sang hồ sơ primary.
- Guard quan trọng của merge: primary blacklisted trả `PRIMARY_BLACKLISTED`, tự merge trả `SELF_MERGE`, customer đã có `tags.mergedIntoId` trả `ALREADY_MERGED`.

## 11. Sprint D0: priceLockedAt và AuditLog diff convention

`Booking.priceLockedAt` là thời điểm lần cuối giá sale được khoá cho khách. Field này được set ở cả HOLD và ISSUE; nếu giá airline đổi sau đó, flow tương lai phải re-quote và so với snapshot đang lưu trên booking. Sprint D0 chỉ thêm helper `isPriceLockFresh()` và `shouldRequoteBeforeIssue()` để chuẩn bị cho Sprint E, chưa đổi logic hold/issue hiện tại.

Từ Sprint D trở đi, mutation mới dùng helper `buildAuditDiff()` và `audit()` ở `lib/audit/diff.ts`. Format chuẩn là `{ before, after, changedFields }`: create có `before=null`, update chỉ lưu field thật sự đổi, và `changedFields` luôn tồn tại trong payload audit mới. Log cũ của Sprint A/B/C không rewrite để tránh regression.

## 12. Sprint D1-D4: User, Ownership, Audit Viewer và Dashboard

- User Management nằm ở `/admin/users`, chỉ `SUPER_ADMIN` truy cập. API gồm `GET/POST /api/admin/users`, `GET/PATCH /api/admin/users/:id` và `POST /api/admin/users/:id/reset-password`. Mật khẩu tạm chỉ trả về một lần, không ghi plaintext vào AuditLog.
- Ownership áp dụng cho booking: `NHAN_VIEN_BAN` chỉ thấy và mutate booking do mình tạo; `KE_TOAN` xem toàn bộ nhưng không issue/cancel, vẫn được ghi nhận payment thủ công. Helper chính nằm ở `lib/auth/ownership.ts`.
- Audit viewer nằm ở `/admin/audit`, chỉ `SUPER_ADMIN`. API `GET /api/admin/audit` mặc định trả log 7 ngày gần nhất nếu không truyền date range, có summary server-side.
- Dashboard nằm ở `/admin/dashboard`; `/admin` redirect về dashboard. API `GET /api/admin/dashboard/summary` có cache in-memory 30 giây theo user, agent tự động chỉ thấy số liệu của mình.

## 13. Sprint D5-D6: Export và Notifications

- Export CSV/Excel đã mở cho Booking, Customer và Payment. CSV có BOM UTF-8 để Excel Windows đọc tiếng Việt đúng; Excel dùng `exceljs`.
- Booking export: `GET /api/admin/bookings/export?status=&from=&to=&format=csv|xlsx`, có filter ownership cho `NHAN_VIEN_BAN`.
- Customer export: `GET /api/admin/customers/export?blacklisted=&from=&to=&format=csv|xlsx`, chỉ dành cho `SUPER_ADMIN`, `QUAN_LY_DAI_LY`, `NHAN_VIEN_BAN`.
- Payment export: `GET /api/admin/payments/export?bookingId=&status=&from=&to=&format=csv|xlsx`, dành cho `SUPER_ADMIN`, `QUAN_LY_DAI_LY`, `KE_TOAN`.
- Notification service nằm ở `lib/notifications`. `notify()` enqueue fire-and-forget, không block transaction chính; email, Slack và Telegram đều mặc định disabled bằng env flag.
- Các flow hold, issue và cancel gọi notification sau khi transaction nghiệp vụ đã commit.

## 14. Sprint D7: Price Alert

- Price Alert dùng model `PriceAlert` với enum `PriceAlertDir` (`BELOW`, `ABOVE`) và `PriceAlertStatus` (`ACTIVE`, `TRIGGERED`, `DISABLED`).
- Admin UI nằm ở `/admin/price-alerts`; `SUPER_ADMIN` và `QUAN_LY_DAI_LY` được tạo, bật/tắt và xóa mềm alert. Các role admin còn lại chỉ xem.
- API admin gồm `GET/POST /api/admin/price-alerts`, `GET/PATCH/DELETE /api/admin/price-alerts/:id`.
- Endpoint `/api/n8n/price-alert` vẫn giữ response cũ, đồng thời kiểm tra các alert đang `ACTIVE`. Khi giá hit target, hệ thống chuyển alert sang `TRIGGERED`, set `triggeredAt`, ghi `AuditLog` action `price_alert.trigger` và gửi `notify({ type: "INTERNAL_ALERT" })`.

## 15. Phase 2 Gate P2-0: payOS QR foundation

- Phase 2 dùng payOS làm provider MVP cho QR động và webhook bank. Backend Next.js dùng `@payos/node`, tương tự mẫu chính thức của payOS: tạo payment request bằng `orderCode`, `amount`, `description`, `returnUrl`, `cancelUrl`; webhook phải verify bằng checksum key trước khi ghi DB.
- Model mới `PaymentIntent` lưu yêu cầu thu tiền/QR: `providerOrderCode`, `paymentLinkId`, `amount`, `checkoutUrl`, `qrCode`, `transferContent`, `status`. QR được tạo đúng bằng công nợ còn lại của booking tại thời điểm tạo intent.
- Model mới `BankTransaction` lưu webhook thô từ payOS với `dedupeKey` unique. Nếu webhook trùng, hệ thống trả thành công nhưng không tạo thêm payment. Nếu khách chuyển dư, transaction và intent chuyển sang `MANUAL_REVIEW`, không tự cộng vào `Payment`.
- Model mới `NotificationJob` chuẩn bị cho email automation bền vững. Khi tạo payment intent thành công, hệ thống có thể tạo job email xác nhận giữ chỗ ngay, nhắc thanh toán T-2h và T-30m trước `ttlExpiresAt`.
- Endpoint tạo QR nền tảng: `POST /api/admin/bookings/:id/payment-intents`, dùng cùng quyền với ghi nhận payment và vẫn đi qua ownership guard.
- Endpoint webhook nền tảng: `POST /api/webhooks/payos`. Route này không dùng session admin, chỉ tin payload sau khi `payos.webhooks.verify()` pass.
- Env cần thêm:

```bash
PAYOS_CLIENT_ID=
PAYOS_API_KEY=
PAYOS_CHECKSUM_KEY=
PAYOS_LOG_LEVEL=warn
PAYOS_RETURN_URL=http://localhost:3000/admin/bookings/{bookingId}?payment=success
PAYOS_CANCEL_URL=http://localhost:3000/admin/bookings/{bookingId}?payment=cancelled
PAYOS_WEBHOOK_URL=http://localhost:3000/api/webhooks/payos
```

## 16. Phase 2 Gate P2-1 đến P2-3: QR động, webhook và automation

- Sau khi `POST /api/booking/hold` persist booking thành công, hệ thống sẽ **best effort** tạo luôn `PaymentIntent` payOS cho đúng `balance` hiện tại. Nếu payOS chưa cấu hình hoặc đang lỗi, hold vẫn thành công; admin vẫn có thể tạo QR thủ công từ booking detail.
- Booking detail (`/admin/bookings/:id`) có panel `Thanh toán QR động qua payOS` để xem QR active, lịch sử QR, webhook đã match/manual review và `NotificationJob` đang chờ gửi.
- Webhook `POST /api/webhooks/payos` verify checksum trước khi xử lý. Khi match đúng số tiền, hệ thống tạo `Payment method=QR`, ghi `BankTransaction`, `BookingTimelineEvent`, `AuditLog`, đồng thời gửi internal alert không chặn transaction chính.
- Nếu khách chuyển dư, transaction bị đẩy sang `MANUAL_REVIEW`. Nếu khách chuyển một phần, payment vẫn được ghi nhận `PARTIAL`, nhưng reminder cũ của QR đó sẽ bị hủy để tránh tiếp tục nhắc bằng số tiền đã lỗi thời.
- Màn hình tổng hợp mới `/admin/payments` cho phép đội vận hành xem nhanh các QR active, webhook manual review, webhook auto-match trong ngày và backlog reminder.

## 17. Phase 2 Gate P2-3: cron gửi email xác nhận và nhắc thanh toán

- `NotificationJob` bây giờ được xử lý qua runner `lib/notifications/runner.ts`.
- Cron route: `GET/POST /api/cron/notifications`.
- Route cron yêu cầu header `Authorization: Bearer {CRON_SECRET}` hoặc `x-cron-secret: {CRON_SECRET}`.
- Các job email đang dùng:
  - `BOOKING_HOLD_CONFIRM`
  - `PAYMENT_REMINDER_T_MINUS_2H`
  - `PAYMENT_REMINDER_T_MINUS_30M`
- Nếu booking đã đủ tiền, QR đã hết hiệu lực hoặc amount của QR không còn khớp `balance` hiện tại, reminder job sẽ tự chuyển `CANCELLED` thay vì tiếp tục gửi sai.

## 18. Phase 2 Gate P2-4: báo cáo doanh thu 3 mode

- Màn hình báo cáo mới: `/admin/reports/revenue`.
- API JSON: `GET /api/admin/reports/revenue`.
- Export: `GET /api/admin/reports/revenue/export?format=csv|xlsx`.
- Ba mode báo cáo:
  - `PAYMENT_DATE`: góc nhìn kế toán theo ngày thu tiền, mặc định cho Phase 2.
  - `BOOKING_DATE`: góc nhìn vận hành theo ngày booking được tạo.
  - `ISSUE_DATE`: góc nhìn theo ngày booking được xác nhận xuất vé.
- Báo cáo luôn áp ownership: `NHAN_VIEN_BAN` chỉ thấy dữ liệu booking do mình tạo; các role còn lại theo quyền hiện có.

## 19. Phase 2 Gate P2-5: hardening

- Test suite Phase 2 đã thêm:
  - `lib/notifications/runner.test.ts`
  - `lib/reports/revenue.test.ts`
- Các case đã khóa thêm:
  - email disabled -> `NotificationJob` chuyển `SKIPPED`
  - booking đã đủ tiền -> reminder tự `CANCELLED`
  - balance đổi sau payment partial -> reminder của QR cũ tự `CANCELLED`
  - helper report mặc định `PAYMENT_DATE`, timeline bucket đúng, refund âm được tính đúng theo `netCashIn`

## 20. Checklist vận hành Phase 2

1. Điền đủ `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`.
2. Điền `CRON_SECRET` và cấu hình cron gọi `/api/cron/notifications` mỗi 5 phút.
3. Nếu muốn gửi email thật, bật `NOTIFICATIONS_EMAIL_ENABLED=true` và khai báo SMTP.
4. Test luồng khuyến nghị:
   - hold một booking mới
   - kiểm tra booking detail đã có QR hoặc cảnh báo tạo QR lỗi
   - gọi thử webhook payOS sandbox
   - mở `/admin/payments` để xem webhook/manual review
   - mở `/admin/reports/revenue` để kiểm tra mode `PAYMENT_DATE`
