# Tân Phú APG — Redesign 2026 · Mockup Mobile (Giai đoạn 1)

Bộ mockup tĩnh high-fidelity (HTML/CSS/JS, **không gọi API**) để nghiệm thu UI/UX mobile **trước khi code**, theo **ngôn ngữ thiết kế Apple** và **logo thật** của Tân Phú APG. Mọi trường dữ liệu & hành động ánh xạ 1:1 với backend (cổng 3100) để bước code chỉ là triển khai.

- Khung thiết kế: **390px** (hỗ trợ 360–430px), safe-area, vùng chạm ≥ 44px, CTA neo đáy, bottom sheet.
- Ngôn ngữ: Tiếng Việt đủ dấu · tiền VND (vd `2.450.000 ₫`) + USD phụ.
- A11y: tương phản WCAG AA, focus state, tôn trọng `prefers-reduced-motion`.
- Token/component mở rộng được lên **desktop** (Giai đoạn 2) bằng cùng thang.

> Mở **`index.html`** để duyệt mọi màn trong khung điện thoại (click mở được). Mở **`brand/index.html`** để xem brand guideline.

---

## Cấu trúc thư mục

```
design/redesign-2026/mobile/
├── index.html                  # Mục lục + prototype (khung 390px, click mở)
├── README.md                   # File này
├── brand/
│   ├── index.html              # Brand guideline đầy đủ (Apple) + specimen sống
│   └── tokens.css              # Design tokens --apg-* (port thẳng vào code)
├── assets/
│   ├── logo-appicon.png        # Logo gốc (app icon / nền xanh)
│   ├── logo-symbol-white.png   # Symbol trắng · nền trong suốt
│   ├── logo-symbol-blue.png    # Symbol xanh · nền sáng
│   └── logo-lockup-*.png       # Khóa ngang (symbol + wordmark)
└── screens/
    ├── app.css                 # Hệ component mobile (gồm tokens mirror)
    ├── admin.css               # Component khu admin
    ├── admin-shell.js          # Topbar + drawer nav dùng chung
    ├── home.html  results-oneway.html  results-roundtrip.html
    ├── fare-detail.html  quote.html  hold.html  payment.html
    └── admin-*.html            # 13 trang admin
```

---

## Nhận diện (Phần A)

- **Hướng:** Ngôn ngữ thiết kế Apple — tối giản, nhiều khoảng trắng, phân cấp bằng cỡ chữ/sắc độ, hairline thay viền nặng, bo góc lớn liền mạch, chuyển động tiết chế.
- **Logo:** giữ nguyên logo phượng hoàng cất cánh; chuẩn hóa biến thể trắng / xanh / app-icon, vùng an toàn, kích thước tối thiểu.
- **Màu:** trung tính xám Apple (`#f5f5f7` / trắng / `#1d1d1f`) + **xanh thương hiệu rút từ logo** `#0a74c0` cho hành động & điểm nhấn.
- **Chữ:** SF Pro (fallback **Be Vietnam Pro** — an toàn dấu tiếng Việt). SF Mono cho mã (PNR, mã báo giá); chữ số tabular cho giá/giờ.
- **Tokens:** `brand/tokens.css`, đặt tên trùng hệ `--apg-*` đang dùng → port thẳng vào `app/globals.css` & `tailwind.config.js`.

---

## Bảng ánh xạ: Mockup ↔ Route thật ↔ Endpoint & Field

### Luồng khách hàng

| Mockup | Route thật | Endpoint API | Field chính (Mục 4 & 7) |
|---|---|---|---|
| `home.html` | `/` (app/page.tsx, HomeSearchExperience) | `/api/airports`, `/api/warmup`, `/api/search/lowest-fare` | gửi: `from, to, date, returnDate?, adults, children, infants, cabin, tripType`; lưu `localStorage` |
| `results-oneway.html` | `/search` · OneWayResultsSection | `/api/search`, `/api/search/stream` (SSE) | `FlightResult{ airline, airlineCode, flightNumber, departure/arrival{airport,time}, duration, stops, price{amount,currency,source}, priceUSD, fareBreakdown, fareOptions[] }`; SSE: `session/airline_result/airline_error/done`; `metadata{ totalResults, sourceUsed, airlineErrors }` |
| `results-roundtrip.html` | `/search` · RoundtripResultsSection | `/api/search`, `/api/search/stream` | `departureResults[], returnResults[], pairOptions[]{ outbound, inbound, totalAmount, airlines[], stops }`; xem Theo cặp / Tách chiều |
| `fare-detail.html` | sheet chi tiết (FlightRow) | `/api/fare-detail` | `namthanh.segments[]{ carrierCode, flightNumber, from, to, departDate, arrivalDate, duration, airCraft }`, `fareBreakdown{ baseAmount, taxesFees, totalAmount }`, `fareOptions[]{ class, fareFamily, carryOnText, checkedBaggageText, totalAmount, isBusiness }` |
| `quote.html` | `/quote` | (client) | `QuotePayload{ outbound, inbound?, adults, children, infants, cabin, search, createdAt }`; mã `APG-xxxxxx`; khóa sửa giá đại lý; xuất PDF/JPEG (jsPDF + html2canvas) |
| `hold.html` | HoldBookingModal | `/api/booking/ancillaries`, `/api/booking/hold` | gửi: `searchId, flightId, fareId, passengers[]{ title, firstName, lastName, type, dateOfBirth, loyaltyAirline, loyaltyNumber, passport{...}, listLuggage[], ancillaryServices[] }, contact{ email, fullName, phoneNumber, address, extraInfo }`; nhận: `bookingId, sessionID, totalAmount, pricing{ verified, message }, pnrs[]{ airline, pnr, status, timelimit }` |
| `payment.html` | `/booking/payment/[bookingId]` | `/api/payment/sepay/create`, `/api/payment/sepay/status/[id]`, `/api/exchange-rate` | QR SePay; STK `8869414319` · BIDV · `VU DUC ANH`; nội dung CK; đếm ngược `expiresAt`; trạng thái chờ→đã thanh toán |

### Khu vực Admin

| Mockup | Route thật |
|---|---|
| `admin-login.html` | `/admin/login` |
| `admin-dashboard.html` | `/admin/dashboard` |
| `admin-bookings.html` | `/admin/bookings` |
| `admin-booking-detail.html` | `/admin/bookings/[id]` |
| `admin-payments.html` | `/admin/payments` |
| `admin-markup-rules.html` | `/admin/markup-rules` (+ `/new`, `/[id]/edit` — sheet biểu mẫu) |
| `admin-customers.html` | `/admin/customers` (+ `/[id]`, `/new` — cùng pattern) |
| `admin-users.html` | `/admin/users` (+ `/[id]`, `/new` — cùng pattern) |
| `admin-audit.html` | `/admin/audit` |
| `admin-price-alerts.html` | `/admin/price-alerts` (+ `/new`) |
| `admin-reports-revenue.html` | `/admin/reports/revenue` |
| `admin-menu.html` | `/admin/menu` |
| `admin-web-vitals.html` | `/admin/observability/web-vitals` |

> Các trang `[id]` / `new` của customers & users dùng **cùng pattern thẻ/biểu mẫu dọc**; mockup danh sách đã thể hiện affordance “Thêm/Chi tiết”. Trang markup `new/edit` và price-alerts `new` thể hiện bằng bottom sheet biểu mẫu.

---

## Trạng thái đã thể hiện (Mục 8)

Mỗi màn quan trọng có **dev switcher** (thanh đen, chỉ để review — không thuộc sản phẩm) để xem nhanh các trạng thái:

- **results-oneway**: đang gom hãng (SSE) · có dữ liệu · skeleton · rỗng · lỗi backend (WARMUP_TIMEOUT).
- **hold**: biểu mẫu · lỗi nhập · đang tạo PNR (4 bước progress) · OTP · thành công (booking + PNR + timelimit).
- **payment**: chờ thanh toán (đếm ngược) · đã thanh toán · hết hạn.
- **results-roundtrip**: badge ghép cặp khi streaming · Theo cặp / Tách chiều (tab chiều đi/về).

---

## Quyết định thiết kế

1. **Giá là trọng tâm thị giác** — dùng chữ số tabular, đặt nổi bật ở mỗi thẻ; navy/đen cho cấu trúc, xanh thương hiệu cho hành động.
2. **Bottom sheet** cho lịch, hành khách/hạng ghế, bộ lọc, sắp xếp, chi tiết giá — thao tác một ngón, đáy màn.
3. **Logo hãng** dùng **monogram mã hãng** (màu thương hiệu hãng) làm placeholder trong mockup; khi nối backend thay bằng logo thật (`/api/airline-logo`).
4. **Khóa sửa giá đại lý** ở báo giá: mở bằng mật khẩu (sheet), bật/tắt hiện giá & chi tiết, xuất PDF/JPEG.
5. **Frosted blur** cho thanh nav & CTA đáy — đúng tinh thần Apple, vẫn đọc rõ trên nội dung cuộn.

---

## Đề xuất tương lai (NGOÀI phạm vi — không nằm trong mockup chính)

> Ghi nhận để cân nhắc, **không** tự thêm vào sản phẩm Giai đoạn 1.

- Lưu hành khách thường dùng (passenger profiles) để điền nhanh ở `hold`.
- Gợi ý “giá rẻ nhất tháng” dạng lịch nhiệt (heatmap) trên trang chủ.
- Trạng thái chuyến bay realtime sau khi đặt (delay/gate).
- Apple/Google Pay nếu mở rộng cổng thanh toán ngoài SePay.
- Dark mode cho toàn bộ luồng khách (đã có nền tảng token).

---

## Giai đoạn 2 (Desktop)

Token & component đã thiết kế để mở rộng: cùng thang spacing 4px, cùng màu/typography, chỉ thêm breakpoint và bố cục nhiều cột (master–detail cho admin, 2–3 cột cho kết quả). Không phải làm lại hệ thống.
