# Báo cáo triển khai Phase 2 — QR + Automation + Báo cáo doanh thu

Ngày cập nhật: 24/04/2026
Repo: `F:\Làm việc Ai\booktanphuapg`

## 1. Mục tiêu Phase 2 đã chốt

Phase 2 được triển khai theo 5 quyết định nghiệp vụ đã chốt:

- Provider MVP cho QR động và webhook: `payOS`
- QR luôn tạo đúng bằng số tiền còn phải thanh toán của booking sau khi HOLD thành công
- Nếu khách chuyển dư tiền: không tự động cộng vào `Payment`, chuyển sang `MANUAL_REVIEW`
- Email nhắc thanh toán theo lịch: gửi ngay khi HOLD, nhắc `T-2h` và `T-30m`
- Báo cáo doanh thu hỗ trợ 3 mode ngày, mặc định dùng `PAYMENT_DATE` cho kế toán

Ngoài ra, trước khi code đã tham chiếu 2 repo mẫu của `payOSHQ`:

- `payos-demo-reactJS`: dùng để đối chiếu dữ liệu frontend như `checkoutUrl`, `qrCode`, `transferContent`
- `payos-demo-java-spring`: dùng để đối chiếu flow backend tạo payment link và verify webhook

## 2. Phạm vi đã hoàn thành

Phase 2 đã được hoàn tất qua các gate `P2-0` đến `P2-5`:

| Gate | Nội dung | Trạng thái |
|---|---|---|
| P2-0 | Foundation cho payOS, migration, service lõi | Hoàn thành |
| P2-1 | QR động trên booking detail + lifecycle create/cancel/expire | Hoàn thành |
| P2-2 | Webhook payOS + auto-match payment + nhánh `MANUAL_REVIEW` | Hoàn thành |
| P2-3 | Email confirm HOLD + reminder runner + cron processing | Hoàn thành |
| P2-4 | Báo cáo doanh thu 3 mode + API + export | Hoàn thành |
| P2-5 | Payment ops/admin visibility + hardening + test bổ sung | Hoàn thành |

## 3. Thay đổi kiến trúc chính

### 3.1. Tầng thanh toán QR

Hệ thống không ghi trực tiếp QR vào bảng `Payment` hiện có, mà tách thành 3 lớp:

- `PaymentIntent`: đại diện cho một yêu cầu thanh toán QR/payOS
- `BankTransaction`: đại diện cho webhook/giao dịch nhận từ payOS
- `Payment`: vẫn là sổ cái kế toán chính của hệ admin

Thiết kế này giúp:

- Giữ `Payment` sạch và chỉ chứa khoản thu đã được chấp nhận nghiệp vụ
- Chống xử lý trùng webhook qua `dedupeKey`
- Bắt riêng các case chuyển thiếu, chuyển đủ, chuyển dư
- Cho phép hiển thị lịch sử QR, webhook và trạng thái đối soát ngay trên booking detail

### 3.2. Tầng automation thông báo

Thông báo không còn chỉ là fire-and-forget trong memory. Phase 2 thêm bảng `NotificationJob` để lưu công việc gửi thông báo bền vững, sau đó cron route sẽ quét và xử lý.

Thiết kế này giúp:

- Không mất lịch gửi khi app restart
- Có thể đánh dấu `PENDING`, `PROCESSING`, `SENT`, `FAILED`, `CANCELLED`, `SKIPPED`
- Tự hủy reminder khi booking đã đủ tiền hoặc QR không còn hợp lệ

### 3.3. Tầng báo cáo doanh thu

Thay vì chỉ có dashboard tổng quan, hệ thống có thêm module báo cáo doanh thu riêng với:

- Query tổng hợp theo `PAYMENT_DATE`, `BOOKING_DATE`, `ISSUE_DATE`
- API JSON để hiển thị trong admin
- Export `CSV` và `XLSX`

## 4. Schema và migration mới

### 4.1. Migration

Phase 2 thêm migration:

- `prisma/migrations/20260424193000_phase2_payos_foundation/migration.sql`

### 4.2. Enum mới

Trong `prisma/schema.prisma`, hệ thống đã thêm:

- `PaymentIntentProvider`
- `PaymentIntentStatus`
- `BankTransactionStatus`
- `NotificationJobChannel`
- `NotificationJobStatus`

### 4.3. Model mới

#### `PaymentIntent`

Lưu yêu cầu thu tiền qua payOS:

- `providerOrderCode`
- `paymentLinkId`
- `amount`
- `checkoutUrl`
- `qrCode`
- `transferContent`
- `status`
- `expiresAt`
- `createdById`

#### `BankTransaction`

Lưu webhook/giao dịch nhận về từ payOS:

- `dedupeKey` unique để chống xử lý trùng
- `providerOrderCode`
- `paymentLinkId`
- `amount`
- `status`
- `rawPayload`
- `paymentIntentId`
- `paymentId`

#### `NotificationJob`

Lưu công việc gửi thông báo:

- `channel`
- `type`
- `status`
- `scheduledAt`
- `attempts`
- `maxAttempts`
- `lastError`
- liên kết `bookingId` và `paymentIntentId`

## 5. Luồng nghiệp vụ đã triển khai

### 5.1. HOLD → tạo QR động

Sau khi `POST /api/booking/hold` persist booking thành công:

1. Hệ thống vẫn trả HOLD thành công ngay cả khi payOS lỗi
2. Sau commit, service sẽ `best effort` tạo `PaymentIntent` payOS
3. QR được tạo đúng bằng `balance` hiện tại của booking
4. Nếu payOS chưa cấu hình hoặc lỗi upstream, admin vẫn có thể vào booking detail để tạo QR thủ công

Điểm quan trọng:

- QR không được làm hỏng flow giữ chỗ
- QR chỉ là lớp thanh toán phụ trợ sau HOLD, không phải điều kiện bắt buộc của HOLD

### 5.2. Quản lý lifecycle của QR

Hệ thống đã có helper lifecycle riêng:

- kiểm tra QR hết hạn
- đánh dấu `EXPIRED`
- xác định QR còn active hay không
- chỉ cho phép hủy QR ở trạng thái phù hợp
- tái sử dụng QR nếu `amount` vẫn khớp `balance`

Rule vận hành hiện tại:

- Mỗi booking chỉ nên có 1 QR active tại một thời điểm
- Nếu balance đã đổi thì QR cũ không còn được dùng lại
- Nếu balance về 0 thì không cho tạo QR mới

### 5.3. Webhook payOS → auto-match payment

`POST /api/webhooks/payos` hiện đã xử lý:

1. Verify webhook bằng SDK payOS
2. Tạo hoặc cập nhật `BankTransaction`
3. Match sang `PaymentIntent`
4. Quyết định 1 trong 3 nhánh:
   - `PAID`: chuyển đủ
   - `PARTIAL`: chuyển thiếu
   - `MANUAL_REVIEW`: chuyển dư hoặc case không thể auto-accept
5. Nếu auto-match thành công thì tạo `Payment method=QR`
6. Ghi `BookingTimelineEvent` và `AuditLog`
7. Gửi internal alert ở ngoài transaction chính

### 5.4. Chuyển dư tiền

Theo quyết định nghiệp vụ đã chốt:

- Nếu khách chuyển dư, webhook không tự cộng vào `Payment`
- `PaymentIntent` và `BankTransaction` sẽ chuyển sang `MANUAL_REVIEW`
- Admin sẽ nhìn thấy case này ở booking detail và màn hình payment ops để xử lý thủ công

### 5.5. Email confirm và nhắc thanh toán

Khi tạo `PaymentIntent` thành công, hệ thống có thể tạo `NotificationJob` cho:

- email xác nhận giữ chỗ gửi ngay
- email nhắc trước hạn `T-2h`
- email nhắc trước hạn `T-30m`

Runner `lib/notifications/runner.ts` xử lý các job đến hạn qua cron:

- `GET/POST /api/cron/notifications`

Logic hardening đã có:

- nếu transport email đang tắt thì job thành `SKIPPED`
- nếu booking đã đủ tiền thì reminder bị `CANCELLED`
- nếu QR cũ không còn khớp balance hiện tại thì reminder bị `CANCELLED`

## 6. Route và màn hình mới

### 6.1. API mới

#### Thanh toán QR

- `POST /api/admin/bookings/[id]/payment-intents`
- `DELETE /api/admin/bookings/[id]/payment-intents/[intentId]`
- `POST /api/webhooks/payos`

#### Automation

- `GET /api/cron/notifications`
- `POST /api/cron/notifications`

#### Báo cáo doanh thu

- `GET /api/admin/reports/revenue`
- `GET /api/admin/reports/revenue/export?format=csv|xlsx`

### 6.2. Màn hình admin mới

- `/admin/payments`
- `/admin/reports/revenue`

### 6.3. Màn hình được mở rộng

#### `/admin/bookings/[id]`

Trang booking detail giờ đã có thêm panel:

- QR payOS đang active
- lịch sử `PaymentIntent`
- trạng thái webhook match/manual review
- danh sách `NotificationJob` liên quan

## 7. File chính đã tạo hoặc cập nhật

### 7.1. Thanh toán QR/payOS

- `lib/payments/providers/payos.ts`
- `lib/payments/paymentIntentService.ts`
- `lib/payments/paymentIntentLifecycle.ts`
- `app/api/admin/bookings/[id]/payment-intents/route.ts`
- `app/api/admin/bookings/[id]/payment-intents/[intentId]/route.ts`
- `app/api/webhooks/payos/route.ts`
- `components/admin/PaymentIntentPanel.tsx`

### 7.2. Hold integration

- `app/api/booking/hold/route.ts`

### 7.3. Automation và reminder

- `lib/notifications/jobs.ts`
- `lib/notifications/runner.ts`
- `lib/notifications/templates/bookingHold.ts`
- `lib/notifications/templates/bookingPaymentReminder.ts`
- `app/api/cron/notifications/route.ts`

### 7.4. Payment ops và reports

- `lib/payments/admin.ts`
- `app/admin/payments/page.tsx`
- `lib/reports/revenue.ts`
- `app/admin/reports/revenue/page.tsx`
- `app/api/admin/reports/revenue/route.ts`
- `app/api/admin/reports/revenue/export/route.ts`

### 7.5. Schema, env và docs

- `prisma/schema.prisma`
- `prisma/migrations/20260424193000_phase2_payos_foundation/migration.sql`
- `.env.example`
- `docs/admin-phase1a-setup.md`

## 8. UI và vận hành admin sau Phase 2

### 8.1. Booking detail

Booking detail không chỉ còn là trang nghiệp vụ giữ chỗ/xuất vé nữa, mà đã trở thành điểm điều hành payment:

- xem QR nào đang hiệu lực
- hủy QR cũ
- theo dõi webhook match
- phát hiện case `MANUAL_REVIEW`
- nhìn thấy notification queue gắn với booking

### 8.2. Payment ops

Trang `/admin/payments` cung cấp góc nhìn vận hành:

- số QR active
- số webhook đã auto-match
- số case cần `MANUAL_REVIEW`
- số `NotificationJob` đang chờ xử lý

### 8.3. Revenue report

Trang `/admin/reports/revenue` cho phép xem báo cáo theo:

- `PAYMENT_DATE` mặc định cho kế toán
- `BOOKING_DATE`
- `ISSUE_DATE`

Kèm các khả năng:

- filter theo khoảng ngày
- xem timeline theo ngày
- export `CSV`
- export `XLSX`

## 9. Hardening và rule quan trọng

### 9.1. Idempotency webhook

Webhook payOS có `dedupeKey` unique trong `BankTransaction`, giúp:

- tránh tạo trùng `Payment`
- cho phép trả thành công an toàn với webhook lặp lại

### 9.2. Không block transaction chính

Các side-effect ngoài transaction như internal alert và email không làm hỏng nghiệp vụ chính:

- HOLD vẫn thành công nếu payOS lỗi
- webhook vẫn chốt payment trước, thông báo chạy sau
- cron gửi email retry độc lập

### 9.3. Giữ đúng convention refund hiện tại

Phase 2 không phá convention refund âm của Sprint C:

- báo cáo doanh thu và helper payment flow vẫn trừ refund đúng theo amount âm

## 10. Kết quả xác minh hiện tại

Tại thời điểm lập báo cáo, repo đã được chạy lại kiểm tra và cho kết quả:

- `npm run test` → pass `57/57`
- `npm run build` → pass
- `npm run check:text` → pass

Các nhóm test nổi bật đã pass:

- Hold route mapping error
- Markup engine `18` case
- Audit diff helper
- Ownership helper
- Payment summary
- Payment intent lifecycle
- Payment reconciliation helpers
- Notification queue
- Notification runner
- Revenue helpers

## 11. Cấu hình môi trường cần có để chạy thật

### 11.1. payOS

Cần điền trong `.env.local`:

- `PAYOS_CLIENT_ID`
- `PAYOS_API_KEY`
- `PAYOS_CHECKSUM_KEY`
- `PAYOS_RETURN_URL`
- `PAYOS_CANCEL_URL`
- `PAYOS_WEBHOOK_URL`

### 11.2. Cron notifications

Cần thêm:

- `CRON_SECRET`

Sau đó cấu hình cron gọi:

- `GET /api/cron/notifications`

với header:

- `Authorization: Bearer {CRON_SECRET}`

### 11.3. Email

Nếu muốn email chạy thật, cần điền:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`
- `NOTIFICATIONS_EMAIL_ENABLED=true`

## 12. Giới hạn hiện tại và phần để Phase 2b/Phase 3

Các phần sau hiện chưa tự động hóa hoàn toàn:

- `MANUAL_REVIEW` mới chỉ được surface cho admin, chưa có flow xử lý bán tự động
- Chưa có auto-reconcile nhiều intent vào cùng một booking theo rules phức tạp
- Chưa có job monitor hoặc dead-letter queue riêng cho notification lỗi nhiều lần
- Báo cáo hiện đã đủ dùng cho admin nội bộ, nhưng chưa tách thành module BI sâu

## 13. Đề xuất bước tiếp theo

Nếu đi tiếp sau báo cáo này, em khuyến nghị thứ tự:

1. Cấu hình payOS thật trên môi trường test/staging
2. Cấu hình cron và SMTP thật để kiểm thử đủ vòng email reminder
3. Chạy test UAT 3 kịch bản:
   - khách chuyển đủ tiền
   - khách chuyển thiếu tiền
   - khách chuyển dư tiền vào `MANUAL_REVIEW`
4. Nếu UAT ổn, bổ sung flow xử lý `MANUAL_REVIEW` riêng cho kế toán

## 14. Kết luận

Phase 2 đã hoàn tất đúng định hướng đã chốt: QR thanh toán động bằng `payOS`, webhook đối soát có idempotency, email confirm và nhắc thanh toán theo lịch, cùng module báo cáo doanh thu 3 mode với mặc định `PAYMENT_DATE`.

Về mặt kỹ thuật, hệ thống hiện đã có đủ nền để chạy vận hành thực tế ở mức admin nội bộ. Phần còn lại chủ yếu là cấu hình provider thật, UAT với giao dịch thật và hoàn thiện quy trình xử lý `MANUAL_REVIEW`.
