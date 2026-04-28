# Section 1 — Khảo sát hiện trạng (as-is audit)

## 1.1. Cấu trúc routing FE hiện tại

| File | Route | Mô tả ngắn | Phân loại |
| --- | --- | --- | --- |
| `app/layout.tsx` | Root layout | Layout gốc, metadata SEO, font toàn site. | Shared shell |
| `app/page.tsx` | `/` | Trang public chính: nhập hành trình, warmup backend, gọi `/api/search`, chọn chuyến và đẩy sang `/quote`. | Public, lõi hiện tại |
| `app/search/page.tsx` | `/search` | Trang kết quả kiểu cũ, bọc `SearchResultsClient` và tự gọi `/api/search` theo query string. | Public, có thể là legacy |
| `app/quote/layout.tsx` | `/quote` layout | Metadata riêng cho màn báo giá/giữ chỗ. | Shared shell |
| `app/quote/page.tsx` | `/quote` | Màn báo giá public, đọc `apg_quote_selection` từ `localStorage`, xuất JPG/PDF, mở modal giữ chỗ. | Public |
| `app/opengraph-image.tsx` | `/opengraph-image` | Tạo ảnh Open Graph cho site. | Shared asset |
| `app/api/search/route.ts` | `POST /api/search`, `GET /api/search` | API public tìm chuyến, validate đầu vào, rate limit, gọi `searchNamThanhFlights` và trả thẳng payload. | Public, rất quan trọng; nên tái dùng logic cho admin nhưng không tái dùng response nguyên bản |
| `app/api/booking/hold/route.ts` | `POST /api/booking/hold` | API public giữ chỗ, normalize hành khách rồi proxy sang Nam Thanh backend. | Public, rất quan trọng; sẽ phải mở rộng để ghi Booking vào DB |
| `app/api/booking/ancillaries/route.ts` | `POST /api/booking/ancillaries` | API public lấy hành lý/dịch vụ bổ trợ. | Public helper, có thể tái dùng cho admin |
| `app/api/airports/route.ts` | `GET /api/airports` | Proxy danh sách sân bay từ backend, có cache header. | Public helper, tái dùng được |
| `app/api/exchange-rate/route.ts` | `GET /api/exchange-rate` | Trả tỷ giá VND/USD cho FE. | Public helper, tái dùng được |
| `app/api/fare-detail/route.ts` | `POST /api/fare-detail` | Re-price một lựa chọn bay qua `priceNamThanhFlight`. | Public helper, có thể tái dùng nội bộ |
| `app/api/warmup/route.ts` | `GET /api/warmup` | FE gọi sẵn để backend kiểm tra/refresh session Nam Thanh trước khi người dùng bấm tìm vé. | Public helper |
| `app/api/n8n/search/route.ts` | `POST /api/n8n/search` | Endpoint automation có `API_SECRET_KEY`, format dữ liệu gọn cho n8n/Zalo/Telegram. | Nội bộ automation |
| `app/api/n8n/hold/route.ts` | `POST /api/n8n/hold` | Endpoint automation giữ chỗ có `API_SECRET_KEY`. | Nội bộ automation |
| `app/api/n8n/ancillaries/route.ts` | `POST /api/n8n/ancillaries` | Endpoint automation lấy ancillary. | Nội bộ automation |
| `app/api/n8n/quote/route.ts` | `POST /api/n8n/quote` | Sinh tin nhắn báo giá text/markdown/html cho automation. | Nội bộ automation |
| `app/api/n8n/price-alert/route.ts` | `POST /api/n8n/price-alert` | Quét nhiều tuyến và trả alert message. | Nội bộ automation |

Nhận xét nhanh:

- Route public lõi hiện tại là `/`, `/search`, `/quote`, `/api/search`, `/api/booking/hold`.
- Các route có thể tái dùng cho admin ở mức service là `app/api/search/route.ts`, `app/api/booking/hold/route.ts`, `app/api/booking/ancillaries/route.ts`, `app/api/airports/route.ts`, `app/api/exchange-rate/route.ts`, nhưng response public hiện chưa phù hợp cho admin vì chưa có giá net, markup, lãi.
- Không có `app/admin/**` và cũng chưa có `middleware.ts` để chặn khu admin.

## 1.2. Cấu trúc BE hiện tại

Các endpoint đang được expose trong `src/server.js`:

| Method | Path | Handler | Ghi chú |
| --- | --- | --- | --- |
| `GET` | `/health` | `handleHealth` | Health check tổng hợp session, OCR, cache. |
| `GET` | `/health?probe=true` | `handleHealth` | Health check có probe gọi Muadi exchange-rate thật. |
| `GET` | `/airports` | `handleAirports` | Trả danh sách sân bay từ `data/airports.json`. |
| `GET` | `/session/ensure` | `handleSessionEnsure` | Warm-up session, phục vụ FE `/api/warmup`. |
| `GET` | `/config/exchange-rate` | `handleExchangeRate` | Lấy tỷ giá từ Muadi hoặc cache/fallback. |
| `POST` | `/config/exchange-rate` | `handleExchangeRate` | Cùng handler, khác verb. |
| `POST` | `/auth/login` | `handleLogin` | Kích Playwright login, lưu session file. |
| `POST` | `/flights/search` | `handleSearch` | Tìm chuyến, cache kết quả search trong RAM. |
| `POST` | `/flights/price` | `handlePrice` | Price chi tiết theo `searchId/flightId` hoặc route-based. |
| `POST` | `/bookings/ancillaries` | `handleAncillaries` | Lấy ancillary theo lựa chọn chuyến hoặc route. |
| `POST` | `/bookings/hold` | `handleHold` | Giữ chỗ, có idempotency cache và pricing reconciliation. |
| `GET` | `/bookings/:sessionID` | `handleBookingStatus` | Re-query ticket info/PNR status theo `sessionID`. |

Không thấy endpoint nào dạng “list toàn bộ booking/PNR đã tạo”. Backend hiện chỉ hỗ trợ:

- tạo giữ chỗ;
- tra cứu lại một booking theo `sessionID`;
- không có danh sách PNR toàn cục từ chính backend này.

## 1.3. Nơi lưu trữ hiện tại

### BE đang persist gì lên disk

| Loại dữ liệu | Trạng thái | Đường dẫn cụ thể | Ghi chú |
| --- | --- | --- | --- |
| Session Playwright + localStorage Nam Thanh | Có persist | `F:\Làm việc Ai\namthanh-auto update claude\namthanh-auto-login\session\storage-state.json` | Được ghi bởi `src/login.js`, đọc/refresh bởi `src/muadi-client.js`. Chứa `accessToken`, `refreshToken`, `diff`, `userInfo`, `agentInfo`, `additionalFees`. |
| Ảnh debug login/captcha | Có persist | `F:\Làm việc Ai\namthanh-auto update claude\namthanh-auto-login\screenshots\` | Chỉ phục vụ debug OCR/login, không phải dữ liệu nghiệp vụ. |
| Danh mục sân bay | Có sẵn trên disk, đọc-only | `F:\Làm việc Ai\namthanh-auto update claude\namthanh-auto-login\data\airports.json` | Backend đọc file này để trả `GET /airports`. |
| Search cache | Không persist | Chỉ trong `searchCache: Map()` của `src/server.js` | Mất khi restart process. |
| Booking cache | Không persist | Chỉ trong `bookingCache: Map()` của `src/server.js` | Mất khi restart process. |
| Idempotency cache | Không persist | Chỉ trong `idempotencyCache: Map()` của `src/server.js` | Mất khi restart process. |
| Ancillary cache | Không persist | Chỉ trong `ancillaryCache: Map()` của `src/server.js` | Mất khi restart process. |

### FE có dùng cookie/localStorage cho state nào không

Có, nhưng chỉ là state giao diện, chưa có auth:

- `localStorage['apg_airports_v1']`: cache danh sách sân bay ở browser (`lib/useAirports.ts`).
- `localStorage['apg_search_page_state']`: lưu state tìm kiếm, kết quả, lựa chọn outbound/inbound trên trang `/` (`app/page.tsx`).
- `localStorage['apg_quote_selection']`: truyền lựa chọn chuyến từ `/` sang `/quote` (`app/page.tsx`, `app/quote/page.tsx`).
- `sessionStorage['apg_warmed_at']`: dedupe warmup trong 60 giây để không gọi `/api/warmup` lặp lại (`app/page.tsx`).
- Không thấy cookie auth, không thấy `next/headers` cookies, không thấy `localStorage` nào cho admin/login/session người dùng.

## 1.4. Cơ chế auth hiện có

Hiện có ba lớp auth kỹ thuật, nhưng chưa có auth cho người dùng cuối hoặc admin nội bộ:

1. `NAMTHANH_BACKEND_API_KEY` ở FE:
   FE route/proxy gọi sang backend Nam Thanh nội bộ bằng header `X-API-Key` trong `lib/namthanh.ts`, `lib/exchange.ts`, `app/api/airports/route.ts`, `app/api/warmup/route.ts`.

2. `API_SECRET_KEY` ở FE:
   Các route `app/api/n8n/*` dùng `validateApiKey()` trong `lib/api-auth.ts`. Đây là API key cho automation/n8n, không phải session đăng nhập người dùng.

3. `BACKEND_API_KEY` và `BACKEND_ALLOW_NO_AUTH` ở BE:
   `src/server.js` đọc `BACKEND_API_KEY || API_SECRET_KEY` làm `API_KEY`. Mọi route trừ `/health` và `/airports` đều đi qua `assertAuthorized()`.
   Nếu `BACKEND_ALLOW_NO_AUTH=true` thì backend cho bỏ qua auth, đúng kiểu local dev convenience.

4. Session Nam Thanh:
   Backend đăng nhập vào `booking.namthanh.vn` bằng Playwright, lưu `storage-state.json`, đọc `accessToken/refreshToken`, tự refresh token và warm-up session.

Kết luận:

- Đang có auth service-to-service và auth cho automation.
- Chưa có đăng nhập cho khách hàng.
- Chưa có đăng nhập cho admin panel.
- Chưa có session cookie/JWT/role middleware cho người dùng nội bộ.

## 1.5. Markup/giá hiện tại

Kết quả grep trong cả hai repo cho thấy chưa có module markup/phí dịch vụ đúng nghĩa.

Những gì code hiện tại đang làm:

- `app/api/search/route.ts` gọi `searchNamThanhFlights(body)` rồi `return NextResponse.json(payload)` gần như nguyên trạng.
- `lib/namthanh.ts` chuẩn hóa mỗi `FlightResult` bằng `fareBreakdown.totalAmount ?? price.amount` và gán lại vào `price.amount`.
- Ở backend, `fullFareForAdult()` tính giá người lớn bằng `fareADT + taxADT + vatADT + issueFeeADT`.
- `toPublicFlight()` đẩy `summary.total` thẳng ra public `price.amount` và `fareBreakdown.totalAmount`.
- `booking-workflow.js` có trường `adminFee: 0`, nhưng đây chỉ là giá trị cố định trong payload gửi Muadi, chưa phải markup engine có rule.

Kết luận thực tế:

- Giá khách đang thấy ở FE là giá tổng từ Nam Thanh/Muadi sau khi backend normalize, có bao gồm `issueFeeADT` của đối tác.
- Chưa có lớp cộng markup riêng của đại lý TAN PHU APG.
- Chưa có `service fee` riêng cho web public.
- Chưa có chỗ nào lưu snapshot markup/lãi.

Nói cách khác: giá public hiện gần với “giá net/giá đối tác đã normalize” hơn là “giá bán có markup”.

## 1.6. Nơi tạo PNR

Flow hiện tại:

1. `components/HoldBookingModal.tsx` gọi `POST /api/booking/hold` và mặc định gửi `dryRun: true`; chỉ khi người dùng tick “Tạo PNR thật” mới gửi `dryRun: false`.
2. `app/api/booking/hold/route.ts` normalize hành khách, lấy `searchId/flightId/fareId`, rồi gọi `holdNamThanhBooking()`.
3. `lib/namthanh.ts` gọi backend `POST /bookings/hold`.
4. `src/server.js` xử lý trong `handleHold()`:
   - nếu có `searchId` thì dùng `holdFromCachedSelection()`;
   - nếu không có thì route-based hold;
   - nếu thành công thì chuẩn hóa response bằng `normalizeHoldSummary()`;
   - lưu response vào `bookingCache` trong RAM với `holdId`.
5. Nếu cần đồng bộ lại PNR, backend chỉ có `GET /bookings/:sessionID` để gọi `booking/ticket-info-by-id`.

Hiện đang lưu ở đâu:

- Có `bookingCache` trong RAM, TTL 1 giờ mặc định.
- Không có DB.
- Không có file JSON lưu Booking/PNR nghiệp vụ.
- Không có endpoint list các PNR đã tạo.

Kết luận:

- PNR được tạo thật ở Nam Thanh khi `dryRun=false`.
- Metadata booking nội bộ hiện chỉ sống tạm trong memory cache/backend response.
- Sau khi restart backend, không còn danh sách booking nội bộ để admin quản lý.

# Section 2 — Khoảng cách (gap) so với Phase 1

| Yêu cầu Phase 1 | Khoảng cách hiện tại |
| --- | --- |
| 1. Auth + 4 role | Chưa có gì cho admin/end-user. Hiện chỉ có `API_SECRET_KEY` cho `app/api/n8n/*` và `BACKEND_API_KEY`/`BACKEND_ALLOW_NO_AUTH` cho FE gọi BE. Chưa có `User`, `passwordHash`, session cookie, middleware, role check, last login, 2FA. |
| 2. Dashboard tổng quan | Có một phần rất nhỏ qua `GET /health` ở backend, nhưng đó là health kỹ thuật, không phải KPI nghiệp vụ. Chưa có booking persisted nên cũng chưa thể tổng hợp doanh thu, PNR mở, thanh toán chờ xử lý hay hiệu quả markup. |
| 3. Quản lý PNR | Có một phần qua `POST /api/booking/hold` và `GET /bookings/:sessionID`, nhưng thiếu gần như toàn bộ lớp admin: không có DB lưu booking, không có list/detail admin, không có timeline sync lưu lại, không có phân biệt 1 booking nhiều PNR, không có bộ lọc theo trạng thái/nhân viên/khách hàng. |
| 4. Quản lý phí dịch vụ (markup engine) | Chưa có. `app/api/search/route.ts` trả thẳng kết quả từ `searchNamThanhFlights`, còn `lib/namthanh.ts`/`src/server.js` chỉ normalize giá đối tác. Không có rule table, không có cache invalidate, không có snapshot markup khi giữ chỗ. |
| 5. In hành trình | Có một phần qua `/quote` vì trang này đã xuất JPG/PDF client-side bằng `html2canvas` và `jspdf`, nhưng đó là báo giá public, không phải itinerary/e-ticket admin có branding và dữ liệu booking thật từ DB/PNR. |
| 6. Quản lý khách hàng | Có một phần rất mỏng qua `contact` và thông tin hành khách đang được nhập trong `HoldBookingModal.tsx` rồi chuyển sang backend. Thiếu hoàn toàn `Customer` CRUD, dedupe theo SĐT/email, lịch sử mua, blacklist, tag. |
| 7. Thanh toán tiền mặt + chuyển khoản thủ công | Chưa có gì. Không có `Payment` table, không có trạng thái thanh toán, không có upload bằng chứng, không có đối soát thủ công, không có màn kế toán. |
| 8. Audit log | Chưa có gì ở tầng nghiệp vụ. Có log console ở backend, nhưng không có bảng insert-only cho hành động admin như login, sửa markup, đổi trạng thái booking, ghi nhận thanh toán. |

# Section 3 — Đề xuất kiến trúc dữ liệu (storage)

## Phương án A — SQLite file-based

Đề xuất kỹ thuật:

- `Prisma + SQLite` hoặc `better-sqlite3` trong repo FE.
- File DB đặt cùng Next.js app, ví dụ `booktanphuapg/data/admin-phase1.sqlite`.

Ưu điểm:

- Nhanh nhất để triển khai cho Phase 1.
- Không phải dựng thêm service mới ngoài FE hiện có.
- Rất phù hợp mô hình đại lý nhỏ, 1 app server, < 10k PNR/tháng.
- Backup dễ: copy file + dump định kỳ.
- Next.js App Router có thể đọc/ghi trực tiếp qua route handlers cho `/admin` và các API hiện có.

Nhược điểm:

- Không hợp nếu deploy kiểu serverless hoặc nhiều instance FE cùng lúc.
- Concurrency và migration story kém linh hoạt hơn Postgres khi hệ thống lớn lên.
- Cần đảm bảo host có persistent disk.

## Phương án B — Postgres self-hosted

Đề xuất kỹ thuật:

- `Prisma` hoặc `Drizzle` + Postgres Docker/local service.

Ưu điểm:

- Scale và concurrency tốt hơn SQLite.
- Hợp nếu sau này tách FE/BE rõ hơn hoặc có nhiều worker sync.
- Migration/báo cáo/phân tích dữ liệu dài hạn tốt hơn.

Nhược điểm:

- Tăng ops ngay từ ngày đầu: Docker, backup, restore, monitoring.
- Thời gian dựng ban đầu lớn hơn trong khi Phase 1 chủ yếu là overlay admin nội bộ.
- Với một dev và một sprint đầu, chi phí vận hành chưa thật sự đáng.

## Phương án C — Supabase / Neon managed

Đề xuất kỹ thuật:

- Managed Postgres, FE kết nối trực tiếp hoặc qua server routes.
- Có thể tận dụng auth managed nếu muốn.

Ưu điểm:

- Không phải tự vận hành database.
- Backup/PITR và môi trường từ xa tốt hơn SQLite.
- Hợp nếu dự án xác định sẽ có nhiều môi trường hoặc nhiều máy triển khai sớm.

Nhược điểm:

- Tăng phụ thuộc dịch vụ ngoài ngay từ Phase 1.
- Auth managed dễ chồng chéo với nhu cầu role nội bộ riêng.
- Chi phí và độ phức tạp mạng lớn hơn nhu cầu hiện tại.

## So sánh theo tiêu chí

| Tiêu chí | A. SQLite | B. Postgres self-hosted | C. Supabase / Neon |
| --- | --- | --- | --- |
| Dễ triển khai | Tốt nhất | Trung bình | Tốt |
| Ops sau này | Kém hơn nếu scale | Khá | Tốt |
| Chi phí | Gần như 0 | Thấp nhưng có công vận hành | Có phí dịch vụ |
| Hợp scale `< 10k PNR/tháng` | Rất hợp | Hơi dư cho Phase 1 | Hợp nhưng hơi nặng |
| Backup | Copy file + dump | `pg_dump`/snapshot | Managed backup |
| Migration story | Đủ dùng | Rất tốt | Rất tốt |

## Khuyến nghị cho Phase 1

Khuyến nghị: **Phương án A — `Prisma + SQLite`, đặt DB trong repo FE**.

Lý do:

- Admin panel sẽ sống ngay trong Next.js FE ở `book.tanphuapg.com/admin`, nên user/role/customer/payment/audit/markup đều là concerns của FE.
- Public search route cũng nằm ở FE, nên đặt `MarkupRule` cùng DB với route này giúp áp dụng markup ở đúng nơi và tránh để BE bị “nhiễm” business rule của đại lý.
- Flow hold hiện đã đi qua FE `/api/booking/hold`; chỉ cần write-through vào DB sau khi backend giữ chỗ thành công là đủ để tạo `Booking` overlay mà chưa bắt BE gánh thêm persistence.
- BE có thể tiếp tục đóng vai integration service thuần với Nam Thanh; FE trở thành system-of-record cho dữ liệu admin nội bộ.

Điều kiện để khuyến nghị này đúng:

- Deploy FE trên một máy có persistent disk.
- Chưa cần scale ngang nhiều instance ngay trong Phase 1.

Nếu user xác nhận sẽ deploy dạng nhiều instance hoặc serverless, nên bỏ qua A và nhảy thẳng sang **C** hoặc **B**.

# Section 4 — Đề xuất data model (schema)

Khuyến nghị lưu tiền dưới dạng **số nguyên VND** để tránh lỗi làm tròn. Pseudo schema dưới đây cố ý thêm vài cột ngoài danh sách tối thiểu để khớp thực tế code hiện tại, đặc biệt là `sessionId`, `idempotencyKey` và bảng `BookingPnr`.

```prisma
enum Role {
  SUPER_ADMIN
  QUAN_LY_DAI_LY
  NHAN_VIEN_BAN
  KE_TOAN
}

enum BookingStatus {
  DRAFT
  HELD
  PRICING_PENDING
  TICKETED
  EXPIRED
  CANCELLED
  FAILED
}

enum MarkupType {
  PERCENT
  FIXED
}

enum PaymentMethod {
  CASH
  BANK
  QR
  CARD
  CREDIT
}

enum PaymentStatus {
  PENDING
  PARTIAL
  PAID
  REJECTED
  REFUNDED
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  role          Role
  fullName      String
  phone         String?
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
  lastLoginAt   DateTime?
  twofaSecret   String?

  @@index([role, active])
}

model Customer {
  id            String    @id @default(cuid())
  fullName      String
  phone         String?
  email         String?
  idNumber      String?
  passport      String?
  dob           DateTime?
  tags          Json?
  blacklisted   Boolean   @default(false)
  createdById   String?
  createdAt     DateTime  @default(now())

  @@unique([phone, email])
  @@index([phone])
  @@index([email])
  @@index([createdById, createdAt])
}

model Booking {
  id                 String        @id @default(cuid())
  pnr                String?
  sessionId          Int?
  searchId           String?
  idempotencyKey     String?       @unique
  airline            String?
  routeSummary       String
  departAt           DateTime?
  returnAt           DateTime?
  tripType           String
  adt                Int           @default(1)
  chd                Int           @default(0)
  inf                Int           @default(0)
  cabin              String?
  netAmount          Int
  saleAmount         Int
  markupAmount       Int           @default(0)
  serviceFeeAmount   Int           @default(0)
  profit             Int           @default(0)
  currency           String        @default("VND")
  status             BookingStatus @default(HELD)
  ttlExpiresAt       DateTime?
  customerId         String?
  createdById        String?
  channel            String        @default("web")
  source             String        @default("namthanh")
  notes              String?
  markupSnapshot     Json?
  namthanhRawJson    Json?
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt

  @@index([pnr])
  @@index([sessionId])
  @@index([status, ttlExpiresAt])
  @@index([customerId, createdAt])
  @@index([createdById, createdAt])
}

model BookingPnr {
  id            String    @id @default(cuid())
  bookingId     String
  airline       String?
  pnr           String
  status        String?
  timelimit     DateTime?
  rawJson       Json?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([airline, pnr])
  @@index([bookingId, createdAt])
}

model BookingTimelineEvent {
  id            String    @id @default(cuid())
  bookingId     String
  pnr           String?
  source        String    @default("namthanh")
  eventType     String
  title         String
  payload       Json?
  occurredAt    DateTime
  fetchedAt     DateTime  @default(now())

  @@index([bookingId, occurredAt])
  @@index([pnr, occurredAt])
}

model MarkupRule {
  id                     String      @id @default(cuid())
  scope                  String
  channel                String?
  airline                String?
  cabin                  String?
  paxType                String?
  domesticInternational  String?
  routeFrom              String?
  routeTo                String?
  markupType             MarkupType
  markupValue            Decimal
  serviceFee             Int         @default(0)
  active                 Boolean     @default(true)
  priority               Int         @default(100)
  createdById            String?
  createdAt              DateTime    @default(now())

  @@index([active, channel, airline, cabin, paxType, domesticInternational, priority])
}

model Payment {
  id             String        @id @default(cuid())
  bookingId      String
  method         PaymentMethod
  amount         Int
  currency       String        @default("VND")
  status         PaymentStatus @default(PENDING)
  paidAt         DateTime?
  proofUrl       String?
  transactionRef String?
  receivedById   String?
  reconciledAt   DateTime?
  notes          String?
  createdAt      DateTime      @default(now())

  @@index([bookingId, createdAt])
  @@index([status, paidAt])
  @@index([transactionRef])
}

model AuditLog {
  id           String    @id @default(cuid())
  actorId      String?
  entity       String
  entityId     String
  action       String
  before       Json?
  after        Json?
  ip           String?
  userAgent    String?
  createdAt    DateTime  @default(now())

  @@index([entity, entityId, createdAt])
  @@index([actorId, createdAt])
}
```

Giải thích ngắn cho từng bảng:

- `User`: tài khoản admin nội bộ. `twofaSecret` nullable để Phase 1 có đường nâng cấp 2FA mà chưa bắt bật cho tất cả.
- `Customer`: hồ sơ khách cơ bản. `phone/email` cho dedupe; thực tế nên chuẩn hóa số điện thoại và lowercase email trước khi insert.
- `Booking`: bảng overlay nghiệp vụ của đại lý. Cần thêm `sessionId` vì hiện backend chỉ re-sync theo `sessionID`, không phải theo PNR text thuần.
- `BookingPnr`: rất nên có vì code hiện tại đã hỗ trợ split roundtrip khác hãng, tức một booking có thể sinh nhiều PNR.
- `BookingTimelineEvent`: phục vụ module “timeline sync từ Nam Thanh”, tách riêng khỏi `AuditLog` vì đây là sự kiện từ đối tác chứ không phải thao tác admin.
- `MarkupRule`: bảng rule đủ ngữ cảnh để match theo channel/hãng/hạng/pax/nội địa-quốc tế.
- `Payment`: thanh toán thủ công. `proofUrl` nullable để tiền mặt không cần ảnh.
- `AuditLog`: insert-only; tuyệt đối không update/delete ở tầng ứng dụng.

Lưu ý thiết kế:

- `profit` nên chốt công thức rõ ngay từ đầu: **`profit = saleAmount - netAmount`**, tức bao gồm cả `markupAmount + serviceFeeAmount`.
- `Booking.pnr` nên hiểu là “primary PNR để tra nhanh”, còn danh sách PNR thật nằm ở `BookingPnr`.
- `namthanhRawJson` chỉ nên lưu snapshot cuối cùng; lịch sử biến động để riêng ở `BookingTimelineEvent`.

# Section 5 — Markup engine (module nguy hiểm nhất — cần thiết kế riêng)

## 5.1. Đặt markup engine ở repo FE hay BE?

Khuyến nghị: **đặt markup engine ở repo FE**.

Lý do:

- Public search đang đi qua `app/api/search/route.ts` của FE; đây là nơi bắt buộc phải đổi từ giá net sang giá bán trước khi trả cho khách.
- Admin panel cũng sống trong Next.js FE, nên `MarkupRule` nằm cùng DB với admin/auth sẽ đơn giản hơn nhiều.
- Giữ BE là integration service “net-only” giúp dễ debug với Nam Thanh và tránh việc mọi consumer của BE bị vô tình ăn markup.
- `app/api/booking/hold/route.ts` của FE là chỗ thích hợp để snapshot markup vào `Booking` sau khi hold thành công.

Lưu ý:

- Nếu sau này có thêm nhiều consumer ngoài FE cùng cần giá bán, khi đó nên tách markup engine thành shared package hoặc chuyển xuống service riêng.

## 5.2. Function signature đề xuất

```ts
type MarkupContext = {
  channel: 'web' | 'admin';
  userRole?: Role;
  customerTier?: 'default' | 'vip' | 'corp';
};

type MarkedFlight = FlightResult & {
  pricing: {
    netAmount: number;
    saleAmount: number;
    markupAmount: number;
    serviceFeeAmount: number;
    profitAmount: number;
    appliedRuleId?: string;
    ruleVersion: number;
  };
};

function applyMarkup(
  flight: FlightResult,
  context: MarkupContext
): MarkedFlight
```

Khuyến nghị hành vi:

- **Không mutate** `flight` gốc; luôn clone sâu các trường giá (`price`, `fareBreakdown`, `fareOptions`, `pairOptions` nếu có).
- `price.amount` và `fareBreakdown.totalAmount` của object trả ra phải là **giá bán**.
- Giá net giữ trong `pricing.netAmount`, nhưng chỉ route/admin serializer mới được phép trả field này ra ngoài.
- Với public web, cần strip `pricing.netAmount`, `profitAmount` trước khi `NextResponse.json`.

Nên đi kèm một bước serializer rõ ràng:

- `serializeFlightForWeb(markedFlight)`
- `serializeFlightForAdmin(markedFlight)`

để tránh vô tình lộ giá net do tái dùng type.

## 5.3. Thứ tự ưu tiên khi nhiều rule match

Khuyến nghị:

1. **Độ cụ thể thắng trước**.
2. Nếu cùng độ cụ thể thì **`priority` số lớn thắng**.
3. Nếu vẫn hòa thì rule mới hơn (`createdAt` hoặc `updatedAt`) thắng.

Ví dụ độ cụ thể:

1. `channel + route + airline + cabin + paxType + domesticInternational`
2. `channel + airline + cabin + paxType`
3. `channel + airline + cabin`
4. `channel + airline`
5. `channel`
6. global

Lý do không dùng mỗi `priority`:

- Business user thường kỳ vọng rule chi tiết hơn phải override rule chung, kể cả khi quên chỉnh `priority`.

## 5.4. Caching

Khuyến nghị:

- Cache in-memory danh sách `MarkupRule` trong FE 30-60 giây.
- Mỗi lần admin lưu rule, tăng `ruleVersion` hoặc clear cache trực tiếp.
- Search result không nên cache “giá đã markup” quá lâu; chỉ cache rules và raw search result ngắn hạn.

Phase 1 single-instance:

- In-memory cache + invalidate trực tiếp là đủ.

Nếu sau này multi-instance:

- cần `settings` table có `markupRulesVersion`, hoặc Redis/pub-sub để broadcast invalidation.

## 5.5. Rủi ro race khi rule đổi giữa lúc search và lúc giữ chỗ

Đây là rủi ro lớn nhất.

Khuyến nghị:

- Giá khách nhìn thấy lúc search phải đi kèm **quote snapshot** có TTL.
- Khi khách bấm giữ chỗ, FE không recompute theo rule mới ngay lập tức; thay vào đó dùng snapshot đã báo giá nếu snapshot còn hạn.
- Snapshot này phải được lưu vào `Booking.netAmount`, `Booking.saleAmount`, `Booking.markupAmount`, `Booking.serviceFeeAmount`, `Booking.profit`, `Booking.markupSnapshot`.

Thiết kế an toàn hơn:

- `/api/search` tạo thêm một `pricingToken` opaque hoặc lưu snapshot trong cache theo `searchId + flightId + fareId`.
- `/api/booking/hold` verify token/snapshot rồi mới ghi booking.
- Nếu snapshot hết hạn, buộc khách refresh giá và xác nhận lại.

Nên đồng bộ TTL quote với TTL search cache hiện có của backend, đang mặc định khoảng 15 phút.

## 5.6. Hiển thị cho admin

Khuyến nghị:

- List booking của admin phải đọc từ `Booking` trong DB, không đọc lại từ `/api/search`.
- Các cột “Giá bán”, “Giá net”, “Lãi” lấy từ snapshot stored:
  - `saleAmount`
  - `netAmount`
  - `profit`
- Tạo API riêng, ví dụ `/api/admin/bookings`, để trả DTO admin có đủ ba giá trị này.

Không nên tái dùng `/api/search` cho list booking admin vì:

- `/api/search` là quote-time API, không phải booking-time API;
- route public phải tránh lộ giá net;
- booking list cần dữ liệu persisted, không phải giá hiện tại theo rule mới.

# Section 6 — Tích hợp với flow hiện có

## 6.1. Search flow

Khuyến nghị chèn markup tại **`app/api/search/route.ts`**, nhưng tách engine ra một helper riêng, ví dụ `lib/markup-engine.ts`.

Không nên nhét thẳng vào `lib/namthanh.ts` vì:

- `lib/namthanh.ts` hiện là thin client/proxy tới BE;
- nếu nhét markup vào đó thì mọi consumer của helper này sẽ tự động nhận giá bán, khó debug net price;
- admin và web cần hai serializer khác nhau.

Flow đề xuất:

1. `searchNamThanhFlights()` lấy raw normalized net response.
2. `applyMarkupToSearchResponse(raw, { channel: 'web' })`.
3. Route public trả public DTO đã strip giá net.
4. Route admin sau này dùng cùng helper nhưng `channel: 'admin'`.

Lưu ý thêm:

- `pairOptions.totalAmount` phải tính từ 2 leg đã markup, tránh double markup.
- Nếu có `fareOptions`, từng fare option cũng phải đi qua engine, không chỉ top-level `FlightResult`.

## 6.2. Hold flow

Khuyến nghị trigger ghi DB tại **FE route `app/api/booking/hold/route.ts`**, sau khi backend trả hold thật thành công.

Flow đề xuất:

1. FE nhận request hold.
2. FE verify `pricingToken`/markup snapshot.
3. FE gọi BE `holdNamThanhBooking()`.
4. Nếu `dryRun=true`: không insert `Booking`, chỉ trả preview như hiện tại.
5. Nếu `dryRun=false` và BE trả thành công:
   - upsert `Customer`;
   - insert `Booking`;
   - insert `BookingPnr`;
   - insert `BookingTimelineEvent` đầu tiên;
   - insert `AuditLog`.

Khuyến nghị thêm:

- Dùng luôn `idempotencyKey` hiện đang có trong FE/BE làm khóa chống duplicate booking record ở DB.
- Booking chỉ được coi là “đã ghi sổ” sau khi DB insert thành công; nếu hold thành công mà DB lỗi, cần log/audit ngay để không mất dấu PNR.

## 6.3. Sync PNR từ Nam Thanh

Qua khảo sát `src/server.js` và `src/muadi-client.js`:

- Có `booking/ticket-info-by-id` thông qua `client.getTicketInfoBySessionId(sessionID)`.
- Không thấy endpoint list booking toàn cục.

Vì vậy, khuyến nghị Phase 1:

- **On-demand sync theo từng booking detail**:
  - admin mở detail;
  - FE gọi BE `GET /bookings/:sessionID`;
  - ghi snapshot vào `BookingPnr.rawJson` và append `BookingTimelineEvent`.

- Cron nhẹ tùy chọn:
  - chỉ quét các booking local còn mở (`status in HELD/PRICING_PENDING`, chưa quá `ttlExpiresAt`);
  - lần lượt gọi `GET /bookings/:sessionID`;
  - không cần “list remote booking”.

Điểm quan trọng:

- Phải lưu `sessionId` trong `Booking`, vì hiện BE re-sync theo `sessionID`, không theo `pnr`.

## 6.4. Auth rào cho admin routes

Khuyến nghị: **Auth.js/NextAuth với Credentials Provider + role trong DB + middleware**.

Lý do:

- Hợp với Next.js App Router.
- Dễ gắn `role`, `active`, `lastLoginAt`.
- Dùng cookie HttpOnly an toàn hơn tự viết JWT thủ công.
- Không cần phụ thuộc SaaS ngoài như Clerk trong Phase 1.

Không khuyến nghị:

- `Clerk`: hơi nặng và tốn phí cho một back-office nội bộ nhỏ.
- `Lucia`: làm được, nhưng hiện hệ sinh thái/App Router ít “đường mòn” hơn Auth.js.
- Tự viết JWT cookie: nhanh lúc đầu nhưng dễ tự gánh lỗi bảo mật và revoke session.

## 6.5. Segregation

Khuyến nghị Phase 1: **đặt admin dưới `app/admin/**` theo subpath `/admin`**.

Lý do:

- Đúng với URL mục tiêu `book.tanphuapg.com/admin`.
- Chung domain với public site nên dễ dùng chung layout/fonts/assets.
- Triển khai nhanh hơn subdomain riêng.

Middleware nên block:

- `/admin/:path*`
- `/api/admin/:path*`

Hành vi:

- chưa login -> redirect `/admin/login`;
- login nhưng không đủ role -> trả `403`;
- route public không được nhìn thấy dữ liệu admin.

Subdomain `admin.domain.com` chỉ nên cân nhắc từ Phase 2 khi cần tách hạ tầng hoặc bảo mật biên mạng riêng.

# Section 7 — Rủi ro + câu hỏi cần user chốt trước khi code

- Deploy FE có chạy trên **một VPS có persistent disk** hay kiểu serverless/nhiều instance? Khuyến nghị: một VPS persistent để Phase 1 dùng SQLite an toàn.
- Admin giữ ở **subpath `/admin`** hay muốn tách subdomain riêng? Khuyến nghị: đi subpath `/admin` cho Phase 1.
- Markup áp dụng theo **%**, số tiền cố định, hay kết hợp cả hai? Khuyến nghị: hỗ trợ cả hai ngay từ schema, nhưng rule phổ biến nên ưu tiên số tiền cố định theo hãng/hạng.
- Ưu tiên rule theo **độ cụ thể** hay chỉ theo `priority`? Khuyến nghị: độ cụ thể thắng trước, `priority` chỉ tie-break.
- Khi admin đổi markup trong lúc khách đang xem giá, có giữ **giá đã báo** hay ép refresh giá mới? Khuyến nghị: giữ giá đã báo nếu snapshot còn hạn, hết hạn thì bắt refresh.
- Có chấp nhận mô hình **một booking nhiều PNR** cho roundtrip khác hãng không? Khuyến nghị: có, một `Booking` nhiều `BookingPnr`.
- PNR sync cần **realtime** hay đủ **on-demand + cron cho booking mở**? Khuyến nghị: on-demand + cron nhẹ cho booking còn hiệu lực.
- Dashboard ở sprint đầu cần sâu tới mức nào? Khuyến nghị: chỉ cần KPI tối thiểu `booking hôm nay`, `PNR sắp hết hạn`, `doanh thu`, `chưa thanh toán`.
- Role “Quản lý đại lý” có cần **phân cấp đại lý/chi nhánh** không? Khuyến nghị: chưa, giữ flat 4 role trong Phase 1.
- 2FA bắt buộc cho role nào? Khuyến nghị: bắt buộc `Super Admin` và `Kế toán`, còn lại cho phép bật sau.
- Dùng tiếng Việt hoàn toàn hay song ngữ cho admin UI? Khuyến nghị: tiếng Việt hoàn toàn ở Phase 1 để giảm scope.
- In hành trình cần **HTML print** hay **PDF server-side** ngay từ đầu? Khuyến nghị: HTML print trước, PDF server-side để Phase 1b.
- Ảnh bằng chứng chuyển khoản lưu ở đâu? Khuyến nghị: lưu local disk trên cùng máy FE ở Phase 1 nếu host một VPS; nâng lên S3/Cloudinary sau.
- Cho phép nhân viên **sửa tay giá bán** trên từng booking hay chỉ đi qua markup rule? Khuyến nghị: chỉ qua markup rule ở Phase 1; nếu cho sửa tay phải có reason + audit bắt buộc.
- `n8n/*` và báo giá automation có cần dùng **giá bán sau markup** hay giữ **giá net**? Khuyến nghị: đồng bộ theo giá bán công khai để tránh lệch giá giữa web và kênh chat.
- Audit log giữ bao lâu? Khuyến nghị: tối thiểu 24 tháng, tốt hơn là giữ vĩnh viễn vì volume giai đoạn đầu còn nhỏ.

# Section 8 — Task breakdown có thời lượng ước tính

Ước tính dưới đây giả định:

- 1 dev full-time;
- không có blocker lớn về hạ tầng ngoài phạm vi code;
- deploy trên một máy có persistent disk;
- dùng SQLite + Auth.js/Prisma trong FE.

| ID | Task | Module | Ước tính (giờ) | Phụ thuộc | Ghi chú |
| --- | --- | --- | ---: | --- | --- |
| T01 | Chốt kiến trúc DB, env, backup, thư mục dữ liệu | Nền tảng | 4 | - | Bao gồm quyết định FE-hosted SQLite |
| T02 | Scaffold DB schema nền tảng: `User`, `Customer`, `Booking`, `BookingPnr`, `MarkupRule`, `Payment`, `AuditLog` | Nền tảng | 8 | T01 | Có seed role cơ bản |
| T03 | Tích hợp Auth.js credentials + session cookie + middleware `/admin` | 1 | 8 | T02 | Chưa gồm 2FA bắt buộc |
| T04 | Trang `/admin/login`, layout admin, nav theo role | 1 | 6 | T03 | UI tối giản là đủ |
| T05 | Service `MarkupRule` + resolver + cache invalidate | 4 | 8 | T02 | Lõi logic nguy hiểm nhất |
| T06 | Tích hợp markup vào `/api/search` + serializer public | 4 | 8 | T05 | Bao gồm `fareOptions` và roundtrip pairs |
| T07 | Tạo quote snapshot/pricing token + verify ở hold | 4 | 6 | T05 | Giảm race khi đổi markup |
| T08 | Mở rộng `/api/booking/hold` để ghi `Booking/Customer/BookingPnr/AuditLog` sau hold thật | 3, 6, 8 | 8 | T02, T07 | Dùng `idempotencyKey` chống duplicate |
| T09 | API admin list booking + filter + pagination | 3 | 6 | T08 | Dùng dữ liệu persisted, không re-search |
| T10 | Màn booking detail + force refresh `GET /bookings/:sessionID` + timeline event | 3 | 8 | T08, T09 | Sync on-demand từ Nam Thanh |
| T11 | Dashboard tối giản từ dữ liệu booking/payment hiện có | 2 | 6 | T08 | KPI gọn để vào vận hành |
| T12 | CRUD khách hàng + dedupe cơ bản theo SĐT/email + lịch sử mua | 6 | 8 | T02, T08 | Merge thủ công ở mức tối giản |
| T13 | Ghi nhận thanh toán tiền mặt/chuyển khoản thủ công + trạng thái | 7 | 8 | T02, T08 | Chưa làm QR/webhook |
| T14 | Template in hành trình/e-ticket dạng HTML print + branding | 5 | 8 | T08 | PDF server-side để sau |
| T15 | Màn audit log + filter actor/entity/action | 8 | 6 | T08 | Bản ghi insert-only |
| T16 | QA, hardening role matrix, test hồi quy flow search/hold/admin | Cross-cutting | 8 | T03-T15 | Cần test kỹ dry-run vs hold thật |

**Tổng ước tính: 110 giờ**

Nhận xét:

- Về mặt số học vẫn nằm dưới mốc 120 giờ.
- Nhưng do có nhiều ẩn số về auth, markup snapshot, upload proof và deploy, lịch này là **khá chặt**.

Vì vậy vẫn nên chia đợt:

- **Phase 1a**: T01-T11 và T15.
- **Phase 1b**: T12-T14.

# Section 9 — Xung đột tiềm tàng với code hiện tại

| File | Mức tác động dự kiến | Thay đổi dự kiến |
| --- | --- | --- |
| `app/api/search/route.ts` | Rất cao | Đây sẽ là điểm chèn markup engine cho public web. Route hiện đang trả raw payload từ `searchNamThanhFlights`, nên sẽ phải thêm bước apply markup, serializer, quote snapshot. |
| `app/api/booking/hold/route.ts` | Rất cao | Route này sẽ không còn là proxy thuần; sau khi BE hold thành công phải ghi DB, verify pricing snapshot, upsert customer, insert audit log. |
| `components/HoldBookingModal.tsx` | Cao | Hiện modal chỉ gửi thông tin hành khách/liên hệ và `idempotencyKey`; sau này gần như chắc phải gửi thêm `pricingToken`, context channel và có thể `customerId` nếu admin tạo hộ khách cũ. |
| `app/page.tsx` | Cao | Trang public hiện lưu nguyên state kết quả vào `localStorage`; nếu áp dụng markup snapshot an toàn thì dữ liệu lưu cục bộ sẽ phải chứa token hoặc reference thay vì chỉ giá hiển thị. |
| `app/quote/page.tsx` | Trung bình đến cao | Trang báo giá hiện dùng `localStorage` + export client-side. Nếu admin cần in itinerary/e-ticket từ booking thật, route này hoặc logic liên quan có thể phải tách bớt khỏi public quote. |
| `lib/namthanh.ts` | Trung bình | Nên giữ vai trò raw FE client tới BE, nhưng có thể cần mở rộng type/DTO nội bộ để hỗ trợ admin serializer hoặc metadata sync tốt hơn. Không nên nhúng business markup trực tiếp tại đây nếu vẫn giữ BE net-only. |
| `lib/types.ts` | Trung bình | Kiểu `FlightResult`, `HoldBookingResponse` và DTO admin nhiều khả năng cần mở rộng để chứa `pricing`, `sessionId`, `BookingPnr`, timeline DTO. |
| `src/server.js` | Trung bình | Nếu giữ DB ở FE thì backend không cần ôm persistence mới, nhưng vẫn có thể cần trả raw `ticket-info-by-id` giàu dữ liệu hơn hoặc expose field tốt hơn cho PNR sync admin. |
| `src/muadi-client.js` | Trung bình | Có thể cần mở rộng client để lấy được thêm dữ liệu sync/PNR chi tiết nếu admin detail cần nhiều hơn response hiện tại. |
| `app/api/booking/ancillaries/route.ts` | Thấp đến trung bình | Có thể cần admin-aware context nếu admin tạo booking từ giao diện nội bộ và muốn ancillary flow thống nhất với public. |

Điểm cần nhìn trước:

- FE hiện đang là BFF cho public flow. Khi thêm admin panel, FE sẽ chuyển từ “proxy mỏng” sang “application server có state nghiệp vụ”.
- BE hiện giữ nhiều cache quan trọng trong RAM. Nếu admin dựa vào dữ liệu bền vững, DB overlay ở FE phải là nguồn sự thật, không thể dựa vào `bookingCache`.

# Section 10 — Kết luận + gợi ý thứ tự triển khai

## 10.1. Có nên làm Phase 1 full 8 module hay cắt thành 1a + 1b?

Khuyến nghị: **nên cắt thành 1a + 1b**.

Đề xuất:

- **Phase 1a (4 module cốt lõi)**:
  - Module 1: Auth + 4 role
  - Module 3: Quản lý PNR
  - Module 4: Quản lý phí dịch vụ
  - Module 8: Audit log

- **Phase 1b (4 module bổ sung)**:
  - Module 2: Dashboard hoàn chỉnh
  - Module 5: In hành trình
  - Module 6: Quản lý khách hàng
  - Module 7: Thanh toán thủ công

Lý do cắt:

- Markup engine + snapshot hold là phần rủi ro cao nhất và ảnh hưởng trực tiếp doanh thu.
- Không có lớp persistence hiện hữu, nên auth/booking/audit phải được dựng chuẩn trước.
- Customer, payment và print đều cần dữ liệu booking đã ổn định rồi mới làm mượt được.

## 10.2. Ba quyết định kiến trúc user cần chốt trước khi sprint 1 bắt đầu

1. **DB đặt ở đâu và deploy kiểu gì**: nếu FE chạy một VPS có disk bền thì chốt SQLite ở FE; nếu không, phải đổi sang Postgres ngay từ đầu.
2. **Giá giữ nguyên theo quote snapshot hay recompute theo rule mới lúc hold**: đây là quyết định ảnh hưởng trực tiếp UX, khiếu nại giá và thiết kế token/snapshot.
3. **Admin đi subpath `/admin` hay hạ tầng riêng**: quyết định luôn cách auth cookie, middleware và tổ chức route/API.

## 10.3. Nếu chỉ có 1 tuần, làm gì trước?

Nếu chỉ có 1 tuần, nên làm trước ba thứ: dựng auth nội bộ có role, thêm SQLite overlay để ghi `Booking` sau hold thật, và hoàn tất markup engine cho `/api/search` kèm snapshot giá khi giữ chỗ. Khi ba phần này chạy ổn, anh sẽ có một “xương sống” đủ để vận hành admin tối thiểu mà không làm lệch giá public, không mất dấu PNR, và không phải dựa vào cache RAM của backend cho nghiệp vụ quan trọng.
