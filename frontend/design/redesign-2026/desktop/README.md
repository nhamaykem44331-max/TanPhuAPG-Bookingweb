# Tân Phú APG — Redesign 2026 · Desktop (Giai đoạn 2)

Mockup tĩnh high-fidelity cho **desktop**, **kế thừa nguyên vẹn** bộ nhận diện & hệ design của mobile (Giai đoạn 1). Không tạo nhận diện mới, không đổi token, không thêm tính năng — chỉ **tái bố cục** cho màn rộng theo ngôn ngữ Apple.

- Khung chuẩn **1440×900** (hỗ trợ 1024–1920). Màn đọc/nhập căn giữa ~1120–1320px; màn ứng dụng (kết quả/admin) nhiều cột.
- "Backend-aware": field & endpoint khớp 1:1 với `../mobile/README.md` (cổng 3100).
- Mở **`index.html`** để duyệt mọi màn trong khung trình duyệt (click mở).

---

## Tái sử dụng từ mobile (nguồn chân lý)

Mọi file desktop **link thẳng** CSS mobile để dùng chung token + component, rồi thêm lớp bố cục desktop:

```html
<link rel="stylesheet" href="../../mobile/screens/app.css" />   <!-- :root tokens + .fcard .btn .chip .seg .group .badges .stream .steps .banner .empty .input .stepper .airmono ... -->
<link rel="stylesheet" href="../../mobile/screens/admin.css" /> <!-- .kpi .dcard .sbadge .pager .fsec .bars .tl .asearch (admin) -->
<link rel="stylesheet" href="../app-desktop.css" />            <!-- lớp bố cục desktop -->
<link rel="stylesheet" href="../admin-desktop.css" />          <!-- admin desktop (sidebar/table/master-detail) -->
```

- **Logo**: dùng `../../mobile/assets/logo-*` (phượng hoàng — không đổi).
- **Màu/chữ/spacing/radius/shadow/motion**: 100% token `--apg-*` của mobile.
- **Component**: tái dùng tên class cũ; chỉ bổ sung biến thể bố cục (vd `.fcard.wide`, `.fcard.rt`).

---

## File mới (chỉ thêm lớp desktop — không sửa mobile)

```
design/redesign-2026/desktop/
├── index.html                  # Mục lục + prototype (khung trình duyệt 1440)
├── README.md
├── app-desktop.css             # .topnav .container .dsearch .popover .results-shell
│                               #  .rail-left/right .fcard.wide .two-col .drawer-right .dialog .hero-d .footer
├── admin-desktop.css           # .admin-shell .sidebar .atopbar .table .master-detail .detail-panel
└── screens/
    ├── admin-desktop-shell.js  # inject sidebar cố định + topbar (dùng ADMIN_NAV chung)
    ├── home / results-oneway / results-roundtrip / fare-detail / quote / hold / payment .html
    └── admin-*.html            # 12 trang admin
```

---

## Bản đồ chuyển hóa mobile → desktop

| Pattern mobile | Pattern desktop |
|---|---|
| Form tìm kiếm xếp dọc + bottom sheet | **Một thanh ngang** `.dsearch` (mọi field trên 1 hàng) |
| Bottom sheet (ngày, khách/hạng) | **Popover** `.popover` thả xuống dưới ô |
| Bottom sheet bộ lọc | **Rail lọc trái cố định** `.filtercard` (áp dụng ngay) |
| Sheet chi tiết giá vé | **Side-drawer phải** `.drawer-right` (×480px) |
| Tab Chiều đi/Chiều về (khứ hồi) | **2 cột song song** `.split` (hiển thị đồng thời) |
| `.qdock` đáy | **Rail phải** `.selcard` / thanh chọn `.selbar` |
| `.bottombar` CTA | nút trong panel sticky phải / `.dialog` |
| Thẻ `.fcard` dọc | `.fcard.wide` ngang (logo · timeline · badge · giá · Chọn) |
| Admin `.drawer` | **Sidebar trái cố định** `.sidebar` |
| Admin `.dcard` (thẻ) | **Bảng** `.table` (sticky thead, cột, phân trang) |
| Admin list → detail | **Master–detail** `.master-detail` (bảng trái · panel phải) |

---

## Bảng ánh xạ: Mockup desktop ↔ Route ↔ Endpoint (giữ nguyên hợp đồng dữ liệu)

| Mockup | Route thật | Endpoint API |
|---|---|---|
| `home.html` | `/` | `/api/airports`, `/api/warmup`, `/api/search/lowest-fare` |
| `results-oneway.html` | `/search` (OneWay) | `/api/search`, `/api/search/stream` (SSE) |
| `results-roundtrip.html` | `/search` (Roundtrip) | `/api/search`, `/api/search/stream` |
| `fare-detail.html` | sheet/drawer chi tiết | `/api/fare-detail` |
| `quote.html` | `/quote` | (client) |
| `hold.html` | HoldBookingModal | `/api/booking/ancillaries`, `/api/booking/hold` |
| `payment.html` | `/booking/payment/[id]` | `/api/payment/sepay/*`, `/api/exchange-rate` |
| `admin-login` | `/admin/login` | — |
| `admin-dashboard` | `/admin/dashboard` | — |
| `admin-bookings` (master–detail) | `/admin/bookings` + `/[id]` | — |
| `admin-payments` | `/admin/payments` | — |
| `admin-markup-rules` | `/admin/markup-rules` (+`/new`,`/[id]/edit` — dialog) | — |
| `admin-customers` | `/admin/customers` (+`/[id]`,`/new`) | — |
| `admin-users` | `/admin/users` (+`/[id]`,`/new`) | — |
| `admin-audit` | `/admin/audit` | — |
| `admin-price-alerts` | `/admin/price-alerts` (+`/new`) | — |
| `admin-reports-revenue` | `/admin/reports/revenue` | — |
| `admin-menu` | `/admin/menu` | — |
| `admin-web-vitals` | `/admin/observability/web-vitals` | — |

> Trường dữ liệu/field chi tiết: xem `../mobile/README.md` (giữ nguyên 100%).

---

## Chiến lược responsive HỢP NHẤT (một codebase mobile + desktop)

Khi code thật, **không dựng hai hệ** — dùng chung token + component, hoán đổi bố cục theo breakpoint:

- **Breakpoint:** `< 768` mobile (bố cục mobile hiện có) · `768–1024` tablet (1–2 cột) · `≥ 1024` desktop (lớp `app-desktop.css`).
- **Container:** mobile full-bleed 16px → desktop căn giữa `max-width` 1120–1320, máng 24px, lưới 12 cột.
- **Component hoán đổi theo breakpoint (cùng dữ liệu, cùng class gốc):**
  - `sheet` ⇄ `popover`/`drawer-right`/`dialog`
  - `.dcard` ⇄ `.table` (admin)
  - `.drawer` ⇄ `.sidebar` (admin)
  - tab khứ hồi ⇄ 2 cột `.split`
  - `.bottombar`/`.qdock` ⇄ rail phải / panel sticky
- **Token giữ nguyên:** spacing 4px, màu, type, radius, shadow, motion — chỉ thay đổi *bố cục*, không thay *nhận diện*.
- **A11y desktop:** `:focus-visible` ring (đã thêm), hover state, điều hướng bàn phím, `prefers-reduced-motion` (token mobile đã hỗ trợ).

Các file mockup này minh hoạ trực tiếp lớp desktop; bước code chỉ cần gộp media query vào component chung.

---

## Đề xuất tương lai (NGOÀI phạm vi)

Giữ nguyên danh sách ở `../mobile/README.md` (profiles khách, heatmap giá, trạng thái chuyến realtime, Apple/Google Pay, dark mode). Không thêm vào mockup chính.
