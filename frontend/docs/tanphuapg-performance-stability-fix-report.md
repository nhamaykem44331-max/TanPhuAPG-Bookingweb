# Báo cáo sửa lỗi ổn định & hiệu năng Tan Phu APG

Ngày thực hiện: 2026-05-09 đến 2026-05-11  
Phạm vi: P0 memory crash/lag, ancillary/hold stability, P1 hoàn tất phase 1-12, P2 hoàn tất: persistent Web Vitals, durable logo cache, multi-month fare calendar.

## 1. Mục tiêu

Sau báo cáo kiểm thử trước đó, mục tiêu chính là giảm nguy cơ Chrome tab `Out of Memory`, tránh dùng fare/search cache hết hạn, và làm luồng giữ chỗ ổn định hơn khi Nam Thanh trả lỗi không khớp chuyến hoặc hành lý hết phiên.

## 2. Thay đổi đã triển khai

### 2.1 Không persist search output vào localStorage

File: `app/page.tsx`

Trước đây `apg_search_page_state` lưu cả:

- `results`
- `meta`
- `outboundResults`
- `inboundResults`
- `pairOptions`
- `selectedOutbound`
- `selectedInbound`
- `selectedOneway`
- `searchedRoute`

Các field trên là output có TTL ngắn và có thể rất lớn. Đã bỏ toàn bộ khỏi payload persist và khỏi dependency array của effect ghi localStorage.

Hiện localStorage chỉ giữ input/tùy chọn nhẹ:

- điểm đi/đến
- ngày đi/ngày về
- loại hành trình
- số khách
- cabin
- chế độ xem/sort/filter nhẹ

Tác động kỳ vọng:

- Không stringify hàng trăm kết quả nhiều lần mỗi giây khi stream search.
- Không reload lại fare/searchId cũ đã hết hạn.
- Giảm memory churn trên Chrome renderer.

### 2.2 Chặn `setMeta` tạo object mới khi dữ liệu không đổi

File: `app/page.tsx`

Đã thêm shallow check trong effect cập nhật `meta` theo `pairOptions.length`, `pairDisplayLimit`, `results.length`.

Trước đây effect luôn trả object mới:

```ts
setMeta((prev) => prev ? { ...prev, ...nextFields } : prev)
```

Hiện tại nếu `totalResults`, `pairCount`, `loadedPairCount`, `displayedPairCount` không đổi thì return lại `prev`.

Tác động kỳ vọng:

- Giảm re-render vòng lặp ngầm.
- Giảm số lần trigger persist state.

### 2.3 Giảm tải airport cache

File: `lib/useAirports.ts`

Đã thay đổi:

- Không còn lưu full 9k sân bay vào localStorage.
- Nếu phát hiện cache cũ `apg_airports_v1` lớn hơn 128 KB thì xóa và không parse.
- localStorage chỉ cache nhóm sân bay phổ biến/nội địa nhỏ.
- Full airport list vẫn có thể được fetch vào memory của tab để không làm mất khả năng tìm sân bay quốc tế.
- Bỏ `tags[]` precomputed trong từng `AirportOption`; tags tìm kiếm được tạo on-the-fly khi user gõ.

Tác động kỳ vọng:

- Tránh `JSON.parse` cache sân bay gần 900 KB mỗi lần mở tab.
- Giảm kích thước object airport trong heap.
- Giảm áp lực GC trên Chrome.

### 2.4 Bổ sung filter nhỏ cho API sân bay

File: `app/api/airports/route.ts`

Đã hỗ trợ:

- `/api/airports?popular=1`
- `/api/airports?domestic=1`

Mục đích:

- Chuẩn bị cho bước tách UI/lazy airport search sau này.
- Cho phép client lấy list nhỏ khi cần.

### 2.5 Sửa dropdown sân bay an toàn hơn trên mobile

Files:

- `app/page.tsx`
- `components/AirportInput.tsx`

Đã đổi chọn item dropdown từ `onMouseDown` sang `onPointerDown`.

Tác động kỳ vọng:

- Ổn định hơn trên iOS Safari/mobile browser.
- Tránh case blur đóng dropdown trước khi commit lựa chọn.

### 2.6 Chỉ mount form mobile hoặc desktop sau khi biết viewport

File: `app/page.tsx`

Trước đây mobile form và desktop form cùng tồn tại trong DOM, chỉ ẩn bằng CSS. Đã bọc điều kiện theo `isDesktopViewport`:

- Desktop viewport: chỉ mount desktop form.
- Mobile/tablet viewport: chỉ mount mobile form.
- Trước khi biết viewport: giữ fallback hiện tại để tránh blank UI trong hydration.

Tác động kỳ vọng:

- Giảm số input/event handler active sau hydration.
- Giảm RAM và handler overhead ở trang chủ.

### 2.7 Thêm error boundary route-level

Files:

- `app/error.tsx`
- `app/quote/error.tsx`
- `app/search/error.tsx`

Tác động kỳ vọng:

- Một lỗi runtime ở route không làm trắng toàn bộ app.
- User có nút thử lại thay vì tab treo/trắng.

### 2.8 Ổn định luồng quote/hold/ancillary đã triển khai cùng đợt

Files:

- `app/page.tsx`
- `app/quote/page.tsx`
- `components/HoldBookingModal.tsx`
- `app/api/booking/hold/route.ts`
- `lib/namthanh.ts`
- `lib/pricing/quoteService.ts`
- `lib/types.ts`
- `app/api/booking/hold/route.test.ts`

Đã triển khai:

- Lưu `searchExpiresAt` từ search result vào quote selection.
- Modal giữ chỗ dùng TTL thật thay vì countdown cố định 10 phút.
- `/quote` refresh search và tìm lại đúng chuyến cũ khi token gần hết hạn.
- Ancillary `Search not found or expired` trả warning mềm, không chặn giữ chỗ.
- Hold `No matching flight found` trả `409 FLIGHT_NOT_AVAILABLE`, không còn báo chung `UPSTREAM_UNAVAILABLE`.
- Test regression cho ancillary expired và no matching flight.

### 2.9 P1 phase 1: Lazy-render danh sách chuyến bay dài

File: `app/page.tsx`

Đã thêm lazy-render cho các danh sách `FlightRow`:

- one-way
- roundtrip outbound
- roundtrip inbound
- mobile roundtrip tab
- tablet two-column
- desktop two-column

Cơ chế:

- Render 40 chuyến đầu.
- Có nút `Tải thêm 40 chuyến`.
- Reset limit khi đổi search generation, filter, sort, trip type hoặc view mode.

Tác động kỳ vọng:

- Không dựng hàng trăm card chuyến bay ngay trong một render.
- Giảm DOM nodes ban đầu và giảm chi phí layout/paint.
- Giữ nguyên UX hiện tại, không thêm dependency mới.

### 2.10 P1 phase 1: Date strip 7 ngày có giá

File: `components/search/DateStrip.tsx`

Đã nâng `DateStrip` từ 5 ngày lên 7 ngày:

- Mobile hiển thị 3 ngày trung tâm.
- Tablet hiển thị 5 ngày.
- Desktop hiển thị 7 ngày.

Tác động kỳ vọng:

- Gần hơn với UX tìm giá mềm theo ngày.
- Không cần triển khai calendar tháng lớn trong cùng patch.

### 2.11 P1 phase 1: Tách footer tĩnh khỏi `app/page.tsx`

Files:

- `components/home/HomeFooter.tsx`
- `app/page.tsx`

Đã tách footer tĩnh thành component riêng.

Tác động kỳ vọng:

- Giảm kích thước monolith từng bước.
- Tách phần ít state trước để tránh rủi ro.
- Chuẩn bị cho các bước tách header/search/results tiếp theo.

### 2.12 P1 phase 2: Tách UI chuyến bay dùng chung

Files:

- `components/flight/AirlineLogo.tsx`
- `components/flight/FlightBadgePills.tsx`
- `app/page.tsx`

Đã tách khỏi `app/page.tsx`:

- `AirlineLogo`
- `airlineColor`
- `FlightBadgePills`

Tác động kỳ vọng:

- Giảm thêm kích thước monolith `app/page.tsx`.
- Gom logic logo hãng và badge chuyến bay vào module dùng chung.
- Chuẩn bị cho bước chuyển logo sang `next/image` hoặc lazy image sau này mà không phải sửa trực tiếp trong trang chủ.

### 2.13 P1 phase 2: Thêm Web Vitals reporter nhẹ

Files:

- `components/analytics/WebVitalsReporter.tsx`
- `app/layout.tsx`

Đã thêm reporter dùng `useReportWebVitals`:

- Development: log metric ra console để đo nhanh LCP/CLS/INP/FCP/TTFB.
- Production: không gửi dữ liệu mặc định.
- Production opt-in: nếu cấu hình `NEXT_PUBLIC_WEB_VITALS_ENDPOINT`, reporter sẽ gửi payload bằng `navigator.sendBeacon` hoặc `fetch keepalive`.

Tác động kỳ vọng:

- Có nền để đo Web Vitals thật thay vì chỉ cảm nhận bằng tay.
- Không làm ảnh hưởng booking flow vì telemetry được bọc lỗi và không chặn UI.
- Không phát sinh network mới ở production nếu chưa cấu hình endpoint.

### 2.14 P1 phase 3: Tách `FlightRow` và giảm hook lặp trong list

Files:

- `components/flight/FlightRow.tsx`
- `app/page.tsx`

Đã tách khỏi `app/page.tsx`:

- `FlightRow`
- `FlightRowSkeleton`
- `RouteMismatchNotice`
- `LoadMoreRowsButton`

Thay đổi kỹ thuật quan trọng:

- Trước đây mỗi `FlightRow` gọi `useAirports()` thông qua `useAirportLabel()`.
- Khi danh sách có nhiều chuyến, điều này tạo nhiều hook tra sân bay và nhiều lần scan airport list theo từng row.
- Hiện tại `app/page.tsx` tạo `airportLabelByCode` bằng `useMemo` một lần theo `airports`, sau đó truyền lookup map xuống `FlightRow`.

Tác động kỳ vọng:

- Giảm số hook/subscription trong danh sách kết quả.
- Tránh scan danh sách sân bay lặp lại theo từng dòng chuyến bay.
- Giảm thêm kích thước monolith `app/page.tsx`.
- Chuẩn bị cho bước virtualization hoặc tách `ResultsList` ở phase sau.

### 2.15 P1 phase 4: Tách `FloatingQuoteDock`

Files:

- `components/flight/FloatingQuoteDock.tsx`
- `app/page.tsx`

Đã tách khỏi `app/page.tsx`:

- `FloatingQuoteDock`
- `buildPassengerSummary`
- `SummaryLine` nội bộ của dock

Tác động kỳ vọng:

- Giảm tiếp kích thước monolith `app/page.tsx`.
- Cô lập UI tổng tạm tính và CTA "Tiếp tục báo giá" khỏi logic search chính.
- Chuẩn bị cho bước tối ưu render dock riêng, ví dụ `memo` hoặc tách layout state sau này.

### 2.16 P1/P2 phase 5: Chuyển `AirlineLogo` sang `next/image`

File: `components/flight/AirlineLogo.tsx`

Đã thay đổi:

- Thay `<img>` bằng `next/image`.
- Giữ cơ chế fallback khi ảnh lỗi qua `onError`.
- Giữ nguồn ảnh đã được chuẩn hóa qua `/api/airline-logo/...`.
- Dùng `unoptimized` cho logo nhỏ để không thêm lớp optimizer lên proxy ảnh hiện tại.
- Fallback text chuyển sang `AP` để tránh phụ thuộc ký tự biểu tượng.

Tác động kỳ vọng:

- Hoàn thành TODO Opus đã nhắc: `AirlineLogo` không còn dùng `<img>`.
- Giữ hành vi tải ảnh ổn định vì src vẫn là local proxy.
- Chuẩn bị cho tối ưu ảnh sâu hơn sau này nếu muốn bật optimizer/remotePatterns có kiểm soát.

### 2.17 P1 phase 6: Tách roundtrip results khỏi `app/page.tsx`

Files:

- `components/flight/RoundtripResultsSection.tsx`
- `components/flight/FlightFilters.tsx`
- `lib/roundtrip.ts`
- `app/page.tsx`

Đã tách khỏi `app/page.tsx`:

- UI chọn chế độ khứ hồi `Gợi ý cặp vé` / `Tự chọn từng chiều`.
- UI danh sách cặp vé khứ hồi.
- UI khứ hồi mobile tab, tablet 2-column, desktop 2-column.
- `SelectedDesktopFlight`.
- Các helper pair source/dedup/sort/merge/bookable sang `lib/roundtrip.ts`.

Thay đổi kỹ thuật quan trọng:

- `app/page.tsx` vẫn giữ state search, selected flights, stream status, display limit và side effects.
- `RoundtripResultsSection` chỉ nhận props và render UI, không tự persist state hoặc gọi search.
- `FilterBar` được chuyển sang `components/flight/FlightFilters.tsx` để dùng chung cho one-way và roundtrip.

Tác động kỳ vọng:

- Giảm mạnh kích thước monolith `app/page.tsx` từ khoảng `2582` dòng xuống `1706` dòng.
- Tách phần UI lớn nhưng ít side-effect trước, đúng lộ trình ít rủi ro hơn search form.
- Dễ tiếp tục tối ưu roundtrip list bằng `memo`/virtualization ở phase sau mà không phải sửa trực tiếp parent.

### 2.18 P2 quick fix: Cache logo proxy phù hợp Vercel serverless

File: `app/api/airline-logo/[code]/route.ts`

Đã thay đổi:

- Tách cache có sẵn trong repo: `public/assets/airlines`.
- Thêm runtime cache: `/tmp/airlines` khi chạy trên Vercel.
- Khi đọc cache, route ưu tiên runtime cache rồi fallback về bundled cache trong `public/assets/airlines`.
- Khi fetch logo từ upstream, route ghi cache vào `/tmp/airlines` trên Vercel thay vì ghi vào filesystem read-only.
- Local development vẫn ghi vào `public/assets/airlines` như trước.

Tác động kỳ vọng:

- Không còn phụ thuộc ghi bền vào filesystem read-only của Vercel serverless.
- Tránh cold fetch lặp lại trong cùng một serverless instance.
- Nếu cache write thất bại, route vẫn trả ảnh đã fetch được và không làm crash UI.

Ghi chú P2 còn lại:

- `/tmp` chỉ là cache tạm theo instance, không phải cache bền toàn hệ thống.
- Nếu traffic logo lớn, nên chuyển sang Vercel KV, R2, S3 hoặc một CDN/cache bền khác.

### 2.19 P1 phase 7: Tách one-way results khỏi `app/page.tsx`

Files:

- `components/flight/OneWayResultsSection.tsx`
- `app/page.tsx`

Đã tách khỏi `app/page.tsx`:

- UI kết quả một chiều trên mobile/tablet.
- UI kết quả một chiều trên desktop.
- Date strip một chiều.
- Filter/sort lane một chiều.
- Skeleton khi route chưa khớp kết quả.
- Load-more cho danh sách một chiều.

Thay đổi kỹ thuật quan trọng:

- `app/page.tsx` vẫn giữ state search, filter, selected flight, display limit và side effects.
- `OneWayResultsSection` chỉ nhận props và render UI.
- Dynamic import `DateStrip` của one-way chuyển khỏi parent, giúp `app/page.tsx` không còn trực tiếp quản DateStrip cho results.

Tác động kỳ vọng:

- Giảm tiếp kích thước monolith `app/page.tsx` từ khoảng `1706` dòng xuống `1609` dòng.
- Cô lập UI một chiều khỏi logic search/persist.
- Chuẩn bị cho bước tách shell/search form hoặc tối ưu list bằng virtualization/memo ở phase sau.

### 2.20 P1 phase 8: Tách search panel khỏi `app/page.tsx`

Files:

- `components/home/HomeSearchPanel.tsx`
- `app/page.tsx`

Đã tách khỏi `app/page.tsx`:

- Search form mobile.
- Search form desktop.
- Mobile airport picker.
- Mobile passenger counter.
- Quick routes.
- Loading plane indicator.
- Error message và note giới hạn hành khách.

Thay đổi kỹ thuật quan trọng:

- `app/page.tsx` vẫn giữ state search, airport selections, trip type, dates, passengers, cabin, loading/error và hàm `search()`.
- `HomeSearchPanel` chỉ nhận props/callback rồi render UI.
- `filterAirports()` và `matchAirport()` cho mobile airport picker đã chuyển khỏi parent.
- `app/page.tsx` không còn import trực tiếp `AirportInput` hoặc icon form từ `lucide-react`.

Tác động kỳ vọng:

- Giảm mạnh `app/page.tsx` từ khoảng `1609` dòng xuống `1192` dòng.
- Cô lập phần form phức tạp để chuẩn bị tách state hoặc store ở phase sau.
- Giữ nguyên cơ chế persist/search hiện tại, tránh thay đổi hành vi đặt vé.

### 2.21 P1 phase 9: Tách hero/summary khỏi `app/page.tsx`

Files:

- `components/home/HomeHeroSummary.tsx`
- `app/page.tsx`

Đã tách khỏi `app/page.tsx`:

- Header hero thương hiệu `TAN PHU APG`.
- Logo local.
- Booking desk route summary.
- Badge tổng số chuyến tìm thấy.

Thay đổi kỹ thuật quan trọng:

- `HomeHeroSummary` chỉ nhận `fromCode`, `toCode`, `hasMeta`, `loading`, `resultCount` và callback `onHomeClick`.
- `app/page.tsx` vẫn quyết định navigation bằng `router.push('/')`.
- Không đổi behavior: click hero vẫn đưa về `/`.

Tác động kỳ vọng:

- Giảm `app/page.tsx` từ khoảng `1192` dòng xuống `1173` dòng.
- Hoàn tất tách các mảng UI chính của homepage: hero, search panel, one-way results, roundtrip results, floating dock, footer.
- Chuẩn bị cho phase tiếp theo: tách hook/state logic hoặc đưa search state sang module riêng.

### 2.22 P1 phase 10: Chuyển `app/page.tsx` thành Server Component wrapper

Files:

- `app/page.tsx`
- `components/home/HomeSearchExperience.tsx`

Đã thay đổi:

- Copy toàn bộ client homepage logic sang `components/home/HomeSearchExperience.tsx`.
- `app/page.tsx` bỏ `"use client"` và chỉ render `<HomeSearchExperience />`.
- Homepage route giờ có server wrapper mỏng, còn client interactivity nằm trong component riêng.

Tác động kỳ vọng:

- `app/page.tsx` giảm từ khoảng `1173` dòng xuống `5` dòng.
- Đạt mục tiêu P1: không còn đặt toàn bộ homepage logic trực tiếp trong route file.
- Chuẩn bị cho việc tách dần hook/state nội bộ trong `HomeSearchExperience`.

### 2.23 P1 phase 11: Đưa persisted input state sang Zustand

Files:

- `lib/homeSearchStore.ts`
- `components/home/HomeSearchExperience.tsx`
- `package.json`
- `package-lock.json`

Đã thêm dependency:

- `zustand`

Đã chuyển sang store:

- `fromSel`
- `toSel`
- `date`
- `returnDate`
- `tripType`
- `adults`
- `children`
- `infants`
- `cabin`
- `roundtripViewMode`
- `pairSourceFilter`
- `sortOneway`
- `sortDepart`
- `sortReturn`
- `hydrated`

Không đưa vào store:

- `results`
- `outboundResults`
- `inboundResults`
- `pairOptions`
- selected flights
- stream state

Lý do:

- Các field kết quả/selected flight có TTL ngắn, không nên persist hoặc chia sẻ qua store ở phase P1.
- Giữ chúng local giúp tránh quay lại lỗi cũ: reload bằng fare/searchId đã hết hạn.

Tác động kỳ vọng:

- Hoàn tất yêu cầu P1 về store cho state input/persisted preferences.
- Giảm coupling giữa localStorage effect và route component.
- Tạo nền để sau này gom search logic vào custom hook hoặc store action riêng.

### 2.24 P1 phase 12: Virtualization/windowing danh sách kết quả

Files:

- `components/flight/VirtualizedFlightRows.tsx`
- `components/flight/OneWayResultsSection.tsx`
- `components/flight/RoundtripResultsSection.tsx`
- `package.json`
- `package-lock.json`

Đã thêm dependency:

- `react-window`

Đã triển khai:

- `VirtualizedFlightRows` dùng `react-window` `List` + `useDynamicRowHeight`.
- One-way flight rows dùng windowing khi list đủ dài.
- Roundtrip legs mobile/tablet/desktop dùng windowing khi list đủ dài.
- Roundtrip pair cards dùng `react-window` riêng qua `VirtualizedRoundtripPairCards`.
- List nhỏ vẫn render thường để tránh overhead không cần thiết.

Tác động kỳ vọng:

- DOM không phình theo toàn bộ số chuyến/cặp vé khi user load thêm nhiều kết quả.
- Giảm chi phí layout/paint khi scroll danh sách dài.
- Giữ cơ chế load-more hiện tại, nên không đổi contract search hoặc quote.

Trade-off:

- Bundle route `/` tăng do thêm `zustand` và `react-window`.
- Đây là đánh đổi có chủ ý để đổi lấy ổn định DOM/memory ở danh sách dài.

### 2.25 P2 phase 1: Filter nâng cao cho kết quả tìm chuyến

Files:

- `lib/flightFilters.ts`
- `lib/flightFilters.test.ts`
- `components/flight/FlightFilters.tsx`
- `components/home/HomeSearchExperience.tsx`
- `components/flight/RoundtripResultsSection.tsx`

Đã triển khai:

- Tách logic filter chuyến bay sang helper thuần `applyFlightFilter()` và `flightMatchesFilter()`.
- Mở rộng `FilterState` từ hãng + số điểm dừng sang thêm:
  - khung giờ khởi hành: cả ngày, 0-6h, sáng, chiều, tối;
  - thời lượng bay: mọi thời lượng, ≤2h, 2-4h, >4h.
- One-way và roundtrip legs dùng chung helper filter mới.
- Roundtrip pair view áp dụng filter riêng cho chiều đi và chiều về, sau đó mới neo pair theo nguồn/cặp.
- Pair view có thêm hai cụm filter “Lọc chiều đi” và “Lọc chiều về”.
- Bổ sung regression test cho filter theo hãng, điểm dừng, giờ bay và thời lượng.

Tác động kỳ vọng:

- User lọc nhanh được chuyến theo giờ bay và thời lượng mà không cần scroll nhiều.
- Pair view không còn chỉ lọc theo nguồn; các cặp khứ hồi cũng tôn trọng filter chiều đi/chiều về.
- Logic filter có test độc lập, giảm rủi ro khi tiếp tục bổ sung filter transit/layover chi tiết.

Ghi chú:

- Filter transit/layover chi tiết theo sân bay nối chuyến chưa bật trong phase này vì dữ liệu layover hiện nằm trong `detailUrl`/segment metadata không đồng nhất giữa nguồn. Phần này nên làm ở P3 sau khi chuẩn hóa segment detail.

### 2.26 P2 phase 2: Chuyển thêm logo local sang `next/image`

Files:

- `components/home/HomeHeroSummary.tsx`
- `components/home/HomeFooter.tsx`
- `components/HoldBookingModal.tsx`
- `components/admin/AdminAirlineLogo.tsx`

Đã triển khai:

- Logo TAN PHU APG ở hero trang chủ dùng `next/image`.
- Logo TAN PHU APG ở footer mobile/desktop dùng `next/image`.
- Logo SePay trong result block giữ chỗ dùng `next/image`.
- `AdminAirlineLogo` dùng `next/image` với `unoptimized` vì src đã đi qua proxy `/api/airline-logo`.

Giữ nguyên có chủ ý:

- Các `<img>` trong `/quote` chưa đổi vì đang nằm trong khu export/print phụ thuộc `html2canvas`; đổi sang wrapper của `next/image` có thể làm lệch ảnh xuất JPG/PDF.
- QR runtime ở `/booking/payment/[bookingId]` chưa đổi vì `intent.qrCode` có thể là data URL hoặc payload động từ provider; `<img>` hiện là lựa chọn trực tiếp và ít rủi ro hơn.

### 2.27 P2 phase 3: First-party Web Vitals collector

Files:

- `components/analytics/WebVitalsReporter.tsx`
- `app/api/analytics/web-vitals/route.ts`
- `app/admin/observability/web-vitals/page.tsx`
- `lib/analytics/webVitals.ts`
- `lib/analytics/webVitals.test.ts`
- `lib/auth/constants.ts`
- `components/admin/AdminNavRail.tsx`

Đã triển khai:

- Reporter mặc định gửi beacon về `/api/analytics/web-vitals`; có thể tắt bằng `NEXT_PUBLIC_WEB_VITALS_ENDPOINT=off` hoặc trỏ sang endpoint khác.
- API `POST /api/analytics/web-vitals` nhận metric thật từ browser, validate payload bằng `zod`, và lưu vào ring buffer runtime tối đa 600 mẫu.
- API `GET /api/analytics/web-vitals` yêu cầu role observability (`SUPER_ADMIN`, `QUAN_LY_DAI_LY`) và trả snapshot tổng hợp.
- Trang admin mới `/admin/observability/web-vitals` hiển thị:
  - p75 theo metric;
  - breakdown theo route;
  - 80 mẫu gần nhất.
- Admin nav thêm mục `Web Vitals`.
- Bổ sung unit test cho store/tổng hợp p75.

Giới hạn có chủ ý:

- Chưa thêm database/migration để tránh rủi ro deploy. Trên Vercel serverless, dữ liệu in-memory có thể tách theo instance và mất khi cold start.
- Nếu cần dashboard bền vững đa instance, bước sau nên chuyển store sang Postgres/Upstash/Vercel KV hoặc dùng Sentry/PostHog.

### 2.28 P2 phase 4: Mini fare calendar trong DateStrip

Files:

- `components/search/DateStrip.tsx`
- `components/search/DateStrip.test.tsx`
- `components/SearchResultsClient.test.tsx`

Đã triển khai:

- Date strip giữ hành vi 7 ngày hiện tại nhưng thêm nút `Tháng` trên tablet/desktop.
- Popover lịch tháng hiển thị toàn bộ ngày trong tháng, giá thấp nhất từng ngày từ cache `/api/search/lowest-fare`.
- Ngày không có giá hoặc đã qua bị disable, không cho chọn nhầm fare rỗng.
- Ngày giá tốt nhất trong tháng vẫn dùng rule chênh lệch tối thiểu `>= 50.000 VND` như date strip để tránh highlight nhiễu.
- Khi chọn ngày trong lịch tháng, popover tự đóng và gọi `onSelect(date)`; không fetch lại lowest fare nếu route đã có cache.
- Test `DateStrip` mới xác nhận mở lịch tháng, chọn ngày và không phát sinh thêm request.
- Test `SearchResultsClient` được cập nhật mock SSE đúng format `/api/search/stream`, tránh fixture JSON cũ làm hook treo ở skeleton.

Giới hạn có chủ ý:

- Calendar tháng hiện là mini popover dùng dữ liệu lowest-fare đang có, chưa phải monthly fare calendar đầy đủ kiểu Skyscanner với backend preload nhiều tháng.
- Nút `Tháng` đang ẩn trên mobile để tránh làm modal/search results chật; mobile vẫn dùng date strip 3 ngày trung tâm và nút ngày trước/ngày kế tiếp.

### 2.29 P2 phase 5: Persistent Web Vitals bằng Postgres

Files:

- `prisma/schema.prisma`
- `prisma/migrations/20260512100000_p2_persistent_observability_logo_cache/migration.sql`
- `lib/analytics/webVitals.ts`
- `lib/analytics/webVitalsPersistence.ts`
- `app/api/analytics/web-vitals/route.ts`
- `app/admin/observability/web-vitals/page.tsx`

Đã triển khai:

- Thêm bảng `WebVitalMetric` để lưu bền metric browser vào Postgres.
- `POST /api/analytics/web-vitals` vẫn ghi runtime buffer, đồng thời best-effort persist vào DB.
- `GET /api/analytics/web-vitals` và `/admin/observability/web-vitals` ưu tiên đọc DB, fallback runtime nếu DB/migration chưa sẵn sàng.
- Giữ retention 30 ngày theo cơ chế cleanup xác suất thấp để tránh tăng trưởng không kiểm soát.

### 2.30 P2 phase 6: Durable airline logo cache bằng Postgres

Files:

- `prisma/schema.prisma`
- `prisma/migrations/20260512100000_p2_persistent_observability_logo_cache/migration.sql`
- `lib/airlineLogoCache.ts`
- `app/api/airline-logo/[code]/route.ts`

Đã triển khai:

- Thêm bảng `AirlineLogoCache` để lưu logo theo `code`, `contentType`, `bytes`, `size`, `sourceUrl`.
- Proxy logo đọc theo thứ tự: bundled/runtime filesystem cache, rồi persistent DB cache, rồi mới fetch upstream.
- Khi fetch upstream thành công, route vẫn ghi `/tmp` hoặc local public cache như trước, đồng thời ghi DB best-effort.
- Giới hạn logo lưu DB tối đa 512 KB để tránh phình Postgres vì file lớn bất thường.

### 2.31 P2 phase 7: Calendar giá nhiều tháng + so sánh ±3 ngày

Files:

- `components/search/DateStrip.tsx`
- `components/search/DateStrip.test.tsx`

Đã triển khai:

- Calendar đọc toàn bộ bucket `M-YYYY` mà endpoint lowest-fare trả về và tạo danh sách tháng có giá.
- Thêm month tabs trong panel `Tháng`, mỗi tab hiển thị giá thấp nhất của tháng.
- Nút tháng trước/kế tiếp chỉ đi qua các tháng có dữ liệu hợp lệ, tránh tháng rỗng.
- Thêm cụm so sánh ±3 ngày dạng bar mini trong panel calendar.
- Test mới xác nhận duyệt sang tháng khác và chọn ngày trong tháng mà không fetch lại lowest-fare.

## 3. Phạm vi còn lại sau P2

P1 và P2 đã hoàn tất theo lộ trình hiện tại. Các mục còn lại dưới đây nên chuyển sang P3 vì thay đổi sản phẩm hoặc kiến trúc rộng hơn:

- i18n tiếng Anh.
- User-side loyalty/history.
- Filter transit/layover chi tiết theo sân bay nối chuyến và thời gian nối chuyến.
- Chuyển ảnh export/QR còn lại sang pipeline riêng nếu xác nhận không ảnh hưởng `html2canvas` và QR runtime.

P1 đã hoàn thành:

- Lazy-render danh sách dài.
- Date strip 7 ngày.
- Error boundary route-level.
- Touch-safe dropdown.
- Tách footer tĩnh.
- Tách logo hãng/badge chuyến bay khỏi `app/page.tsx`.
- Thêm Web Vitals reporter opt-in.
- Tách `FlightRow`/skeleton/list notice khỏi `app/page.tsx`.
- Bỏ `useAirports()` khỏi từng row kết quả.
- Tách `FloatingQuoteDock` khỏi `app/page.tsx`.
- Chuyển `AirlineLogo` sang `next/image`.
- Tách `RoundtripResultsSection`, `FlightFilters` và `lib/roundtrip` khỏi `app/page.tsx`.
- Tách `OneWayResultsSection` khỏi `app/page.tsx`.
- Tách `HomeSearchPanel` khỏi `app/page.tsx`.
- Tách `HomeHeroSummary` khỏi `app/page.tsx`.
- Chuyển `app/page.tsx` thành Server Component wrapper.
- Đưa persisted input state sang Zustand.
- Thêm `react-window` windowing cho flight rows và roundtrip pair cards.

P2 đã triển khai:

- Cache logo proxy phù hợp Vercel serverless bằng `/tmp/airlines`.
- Filter nâng cao theo khung giờ khởi hành và thời lượng bay cho one-way, roundtrip legs và roundtrip pair view.
- Chuyển logo local an toàn sang `next/image` ở home/footer, SePay result block và admin airline logo.
- Thêm Web Vitals collector first-party và dashboard admin runtime.
- Thêm mini fare calendar trong `DateStrip` cho tablet/desktop.
- Lưu bền Web Vitals vào Postgres.
- Lưu bền airline logo cache vào Postgres.
- Nâng DateStrip thành calendar nhiều tháng kèm so sánh giá ±3 ngày.

Lý do các mục P3 chưa triển khai trong patch này:

- Các mục này thay đổi kiến trúc và UX diện rộng.
- Cần thêm dependency hoặc quyết định sản phẩm.
- Rủi ro cao nếu làm cùng patch P0 đang xử lý crash/booking stability.

## 4. Kỳ vọng sau sửa

### Memory

- localStorage không còn chứa search output lớn.
- Cache sân bay cũ lớn sẽ bị xóa tự động.
- Airport object không còn `tags[]` nhân kích thước heap.
- Stringify state không còn chạy theo từng tick stream result.

### Booking stability

- User không giữ chỗ bằng searchId/fareId cũ sau reload.
- Ancillary hết cache không chặn hold.
- Chuyến/fare không còn khớp được báo đúng là `FLIGHT_NOT_AVAILABLE`.

### Mobile UX

- Dropdown sân bay dùng pointer event, ổn định hơn trên touch device.
- Sau hydration không còn mount đồng thời cả form mobile và desktop.

### P1 phase 1

- Các list chuyến bay dài không render toàn bộ ngay từ đầu.
- Date strip hiển thị rộng hơn trên desktop.
- Footer đã tách khỏi monolith.

### P1 phase 2

- Logo hãng và badge chuyến bay đã chuyển sang `components/flight`.
- `app/page.tsx` giảm còn khoảng `2999` dòng sau phase 2.
- Web Vitals reporter đã mount ở root layout, mặc định chỉ log trong development.

### P1 phase 3

- `FlightRow` và các UI phụ của list đã chuyển sang `components/flight/FlightRow.tsx`.
- `app/page.tsx` giảm còn khoảng `2802` dòng sau phase 3.
- Airport label lookup được tính một lần ở parent thay vì gọi `useAirports()` trong từng row.

### P1 phase 4

- `FloatingQuoteDock` đã chuyển sang `components/flight/FloatingQuoteDock.tsx`.
- `app/page.tsx` giảm còn khoảng `2582` dòng sau phase 4.
- UI CTA báo giá đã tách khỏi logic search/stream chính.

### P1/P2 phase 5

- `AirlineLogo` đã dùng `next/image`.
- Logo airline vẫn dùng local proxy `/api/airline-logo/...`, không cần mở rộng `remotePatterns`.
- Dùng `unoptimized` để giữ hành vi hiện tại và tránh double-optimize logo nhỏ.

### P1 phase 6

- Roundtrip results đã chuyển sang `components/flight/RoundtripResultsSection.tsx`.
- `FilterBar` và `SelectedDesktopFlight` đã chuyển sang `components/flight/FlightFilters.tsx`.
- Helper pair merge/dedup/sort/bookable đã chuyển sang `lib/roundtrip.ts`.
- `app/page.tsx` còn giữ state/side effects/search flow, component con chỉ render UI theo props.

### P2 logo proxy cache

- `/api/airline-logo/[code]` đọc bundled cache trong `public/assets/airlines`.
- Trên Vercel, route ghi runtime cache vào `/tmp/airlines` thay vì cố ghi vào filesystem read-only.
- Cache write vẫn best-effort; nếu thất bại, route vẫn trả ảnh fetched để không ảnh hưởng UI.

### P1 phase 7

- One-way results đã chuyển sang `components/flight/OneWayResultsSection.tsx`.
- `app/page.tsx` không còn trực tiếp render `FlightRow`/`FilterBar`/`DateStrip` cho lane một chiều.
- State chọn chuyến, filter, sort, display limit và search side effects vẫn nằm ở parent để tránh đổi hành vi.

### P1 phase 8

- Search panel đã chuyển sang `components/home/HomeSearchPanel.tsx`.
- Mobile airport picker và mobile passenger counter đã rời khỏi `app/page.tsx`.
- `app/page.tsx` vẫn giữ search state và callbacks; component con chỉ render form.

### P1 phase 9

- Hero/header summary đã chuyển sang `components/home/HomeHeroSummary.tsx`.
- `app/page.tsx` vẫn giữ navigation callback, route code và result count.

### P1 phase 10

- `app/page.tsx` đã thành Server Component wrapper chỉ còn render `HomeSearchExperience`.
- Client homepage logic nằm ở `components/home/HomeSearchExperience.tsx`.

### P1 phase 11

- Persisted input/search preference state đã chuyển sang `lib/homeSearchStore.ts` dùng Zustand.
- Search results và selected flights vẫn local để tránh persist dữ liệu fare có TTL ngắn.

### P1 phase 12

- `react-window` đã được thêm vào dependencies.
- `VirtualizedFlightRows` dùng `List` + `useDynamicRowHeight`.
- One-way rows, roundtrip leg rows và roundtrip pair cards đã có windowing khi list đủ dài.

### P2 phase 1

- Filter giờ bay và thời lượng bay dùng helper thuần `lib/flightFilters.ts`.
- Roundtrip pair view lọc được cả chiều đi và chiều về trước khi hiển thị cặp.
- Test `lib/flightFilters.test.ts` khóa các case hãng, điểm dừng, giờ bay và thời lượng.

### P2 phase 2

- Logo local ở hero/footer/home và SePay result block đã dùng `next/image`.
- `AdminAirlineLogo` dùng `next/image` với `unoptimized` sau proxy logo.
- Các ảnh export `/quote` và QR runtime chưa đổi để tránh rủi ro với `html2canvas`/data URL.

### P2 phase 3

- `WebVitalsReporter` gửi metric về endpoint nội bộ theo mặc định.
- `POST /api/analytics/web-vitals` thu metric và lưu ring buffer runtime.
- `/admin/observability/web-vitals` hiển thị p75 theo metric/path và 80 mẫu gần nhất.
- Test `lib/analytics/webVitals.test.ts` khóa logic summary p75.

### P2 phase 4

- Date strip có thêm mini calendar tháng trên tablet/desktop.
- Calendar dùng lại cache lowest-fare theo route, không fetch lại khi chỉ mở/chọn ngày trong tháng.
- Ngày rỗng/quá khứ bị disable để tránh chọn ngày không có fare.
- Test `DateStrip` khóa flow mở lịch tháng và chọn ngày.

### P2 phase 5-7

- Web Vitals được lưu bền vào bảng `WebVitalMetric`; dashboard admin ưu tiên dữ liệu DB.
- Airline logo cache được lưu bền vào bảng `AirlineLogoCache`; proxy không còn phụ thuộc riêng vào `/tmp`.
- DateStrip có thể duyệt nhiều tháng có dữ liệu từ Nam Thanh và hiển thị bar so sánh ±3 ngày.

## 5. Kiểm chứng đã chạy

Các lệnh cần chạy sau patch:

```bash
npx tsc --noEmit --pretty false
npx tsx --test components/search/DateStrip.test.tsx components/SearchResultsClient.test.tsx lib/analytics/webVitals.test.ts lib/flightFilters.test.ts app/api/search/lowest-fare/route.test.ts app/api/booking/hold/route.test.ts
npx tsx --test lib/analytics/webVitals.test.ts
npx tsx --test lib/flightFilters.test.ts
npx tsx --test app/api/booking/hold/route.test.ts
npm run check:text
npx next build
```

Kết quả:

- `npx tsc --noEmit --pretty false`: PASS
- `npx tsx --test components/search/DateStrip.test.tsx components/SearchResultsClient.test.tsx lib/analytics/webVitals.test.ts lib/flightFilters.test.ts app/api/search/lowest-fare/route.test.ts app/api/booking/hold/route.test.ts`: PASS 29/29
- `npx tsx --test lib/analytics/webVitals.test.ts`: PASS 1/1
- `npx tsx --test lib/flightFilters.test.ts`: PASS 1/1
- `npx tsx --test app/api/booking/hold/route.test.ts`: PASS 8/8
- `npm run check:text`: PASS
- `npx next build`: PASS

Ghi nhận sau P1 phase 1:

- Route `/` build size: khoảng `25.9 kB`, First Load JS `118 kB`.
- `app/page.tsx`: khoảng `3049` dòng sau khi tách footer.
- `components/home/HomeFooter.tsx`: component footer tĩnh mới.

Ghi nhận sau P1 phase 2:

- Route `/` build size: khoảng `26 kB`, First Load JS `118 kB`.
- `app/page.tsx`: khoảng `2999` dòng sau khi tách thêm flight UI helper.
- `components/flight/AirlineLogo.tsx`: module logo hãng dùng chung.
- `components/flight/FlightBadgePills.tsx`: module badge chuyến bay dùng chung.
- `components/analytics/WebVitalsReporter.tsx`: reporter đo Web Vitals opt-in.

Ghi nhận sau P1 phase 3:

- `app/page.tsx`: khoảng `2802` dòng.
- `components/flight/FlightRow.tsx`: module row chuyến bay và list helpers.
- `FlightRow` không còn tự gọi `useAirports()`; nhận `airportLabelByCode` từ parent.

Ghi nhận sau P1 phase 4:

- `app/page.tsx`: khoảng `2582` dòng.
- `components/flight/FloatingQuoteDock.tsx`: module dock tổng tạm tính và CTA báo giá.

Ghi nhận sau P1/P2 phase 5:

- `components/flight/AirlineLogo.tsx`: dùng `next/image`.
- Route `/` build size: khoảng `26.3 kB`, First Load JS `124 kB`.
- First Load JS tăng khoảng `6 kB` do thêm runtime `next/image`; đây là trade-off đã ghi nhận để hoàn thành TODO logo.

Ghi nhận sau P1 phase 6:

- `app/page.tsx`: khoảng `1706` dòng.
- `components/flight/RoundtripResultsSection.tsx`: khoảng `813` dòng, chứa UI khứ hồi pair/legs/mobile/tablet/desktop.
- `components/flight/FlightFilters.tsx`: khoảng `132` dòng, chứa `FilterBar` và `SelectedDesktopFlight`.
- `lib/roundtrip.ts`: khoảng `79` dòng, chứa helper pair source/dedup/sort/merge/bookable.
- Route `/` build size: khoảng `27.3 kB`, First Load JS `125 kB`.

Ghi nhận sau P2 logo proxy cache:

- `app/api/airline-logo/[code]/route.ts`: đọc cache từ `/tmp/airlines` và `public/assets/airlines`.
- Trên Vercel, route ghi cache tạm vào `/tmp/airlines`.
- KV/R2/S3/CDN vẫn là lựa chọn P2 nếu cần cache bền giữa nhiều instance.

Ghi nhận sau P1 phase 7:

- `app/page.tsx`: khoảng `1609` dòng.
- `components/flight/OneWayResultsSection.tsx`: khoảng `185` dòng, chứa UI kết quả một chiều mobile/desktop.
- Route `/` build size: khoảng `27.2 kB`, First Load JS `124 kB`.
- `npx tsc --noEmit --pretty false`: PASS sau khi tách one-way.
- `npx tsx --test app/api/booking/hold/route.test.ts`: PASS 8/8.
- `npm run check:text`: PASS.
- `npx next build`: PASS.

Ghi nhận sau P1 phase 8:

- `app/page.tsx`: khoảng `1192` dòng.
- `components/home/HomeSearchPanel.tsx`: khoảng `515` dòng, chứa search form mobile/desktop.
- Route `/` build size: khoảng `27.4 kB`, First Load JS `125 kB`.
- `npx tsc --noEmit --pretty false`: PASS sau khi tách search panel.
- `npx tsx --test app/api/booking/hold/route.test.ts`: PASS 8/8.
- `npm run check:text`: PASS.
- `npx next build`: PASS.

Ghi nhận sau P1 phase 9:

- `app/page.tsx`: khoảng `1173` dòng.
- `components/home/HomeHeroSummary.tsx`: khoảng `54` dòng, chứa hero/header summary.
- Route `/` build size: khoảng `27.3 kB`, First Load JS `125 kB`.
- `npx tsc --noEmit --pretty false`: PASS sau khi tách hero.
- `npx tsx --test app/api/booking/hold/route.test.ts`: PASS 8/8.
- `npm run check:text`: PASS.
- `npx next build`: PASS.

Ghi nhận sau P1 phase 10-12:

- `app/page.tsx`: khoảng `5` dòng, Server Component wrapper.
- `components/home/HomeSearchExperience.tsx`: khoảng `1182` dòng, client search experience.
- `lib/homeSearchStore.ts`: khoảng `76` dòng, Zustand store cho persisted input state.
- `components/flight/VirtualizedFlightRows.tsx`: khoảng `124` dòng.
- `components/flight/RoundtripResultsSection.tsx`: khoảng `935` dòng sau khi thêm pair/leg windowing.
- `components/flight/OneWayResultsSection.tsx`: khoảng `181` dòng sau khi dùng virtualized rows.
- Route `/` build size: khoảng `32.4 kB`, First Load JS `129 kB`.
- Bundle tăng so với phase 9 vì thêm `zustand` và `react-window`; đổi lại P1 có store và windowing thật.
- `npx tsc --noEmit --pretty false`: PASS.
- `npx tsx --test app/api/booking/hold/route.test.ts`: PASS 8/8.
- `npm run check:text`: PASS.
- `npx next build`: PASS.

Ghi nhận sau P2 phase 1:

- `lib/flightFilters.ts`: helper filter thuần cho hãng, điểm dừng, khung giờ khởi hành và thời lượng.
- `components/flight/FlightFilters.tsx`: thêm chip filter giờ bay và thời lượng.
- `components/flight/RoundtripResultsSection.tsx`: pair view có filter riêng cho chiều đi/chiều về.
- `components/home/HomeSearchExperience.tsx`: one-way, roundtrip legs và roundtrip pairs dùng chung logic filter mới.
- Route `/` build size: khoảng `32.9 kB`, First Load JS `130 kB`.
- `npx tsx --test lib/flightFilters.test.ts`: PASS 1/1.
- `npx tsx --test lib/flightFilters.test.ts app/api/booking/hold/route.test.ts`: PASS 9/9.
- `npx tsc --noEmit --pretty false`: PASS.
- `npm run check:text`: PASS.
- `npx next build`: PASS.

Ghi nhận sau P2 phase 2:

- `components/home/HomeHeroSummary.tsx`: logo local dùng `next/image`.
- `components/home/HomeFooter.tsx`: logo local mobile/desktop dùng `next/image`.
- `components/HoldBookingModal.tsx`: logo SePay dùng `next/image`.
- `components/admin/AdminAirlineLogo.tsx`: logo hãng admin dùng `next/image` `unoptimized`.
- `<img>` còn lại chỉ nằm ở `/quote` export/print và QR payment runtime.
- Route `/` build size: khoảng `33.4 kB`, First Load JS `130 kB`.
- `npx tsc --noEmit --pretty false`: PASS.
- `npm run check:text`: PASS.
- `npx next build`: PASS.

Ghi nhận sau P2 phase 3:

- `components/analytics/WebVitalsReporter.tsx`: endpoint mặc định là `/api/analytics/web-vitals`, có thể tắt bằng `NEXT_PUBLIC_WEB_VITALS_ENDPOINT=off`.
- `app/api/analytics/web-vitals/route.ts`: POST public để nhận beacon, GET admin-protected để đọc snapshot.
- `app/admin/observability/web-vitals/page.tsx`: dashboard admin cho metric p75 và recent samples.
- `lib/analytics/webVitals.ts`: runtime ring buffer 600 mẫu.
- `lib/analytics/webVitals.test.ts`: PASS 1/1.
- `npx tsx --test lib/analytics/webVitals.test.ts lib/flightFilters.test.ts`: PASS 2/2.
- `npx tsx --test lib/analytics/webVitals.test.ts lib/flightFilters.test.ts app/api/booking/hold/route.test.ts`: PASS 10/10.
- `npx tsc --noEmit --pretty false`: PASS.
- `npm run check:text`: PASS.
- `npx next build`: PASS, thêm route `/admin/observability/web-vitals` và `/api/analytics/web-vitals`.

Ghi nhận sau P2 phase 4:

- `components/search/DateStrip.tsx`: khoảng `497` dòng sau khi thêm mini calendar tháng.
- `components/search/DateStrip.test.tsx`: khoảng `293` dòng, bổ sung test mở lịch tháng/chọn ngày.
- `components/SearchResultsClient.test.tsx`: mock `/api/search/stream` bằng SSE đúng format production.
- Route `/` build size: khoảng `33.4 kB`, First Load JS `130 kB`.
- `npx tsx --test components/search/DateStrip.test.tsx components/SearchResultsClient.test.tsx lib/analytics/webVitals.test.ts lib/flightFilters.test.ts app/api/booking/hold/route.test.ts`: PASS 23/23.
- `npx tsc --noEmit --pretty false`: PASS.
- `npm run check:text`: PASS.
- `npx next build`: PASS.

Ghi nhận sau P2 phase 5-7:

- Migration mới: `prisma/migrations/20260512100000_p2_persistent_observability_logo_cache/migration.sql`.
- `WebVitalMetric`: bảng lưu bền Web Vitals.
- `AirlineLogoCache`: bảng lưu bền logo airline.
- `lib/analytics/webVitalsPersistence.ts`: khoảng `68` dòng.
- `lib/airlineLogoCache.ts`: khoảng `57` dòng.
- `components/search/DateStrip.tsx`: khoảng `620` dòng sau khi thêm month tabs và bar so sánh ±3 ngày.
- `components/search/DateStrip.test.tsx`: khoảng `330` dòng, thêm test duyệt nhiều tháng.
- Route `/` build size: khoảng `33.4 kB`, First Load JS `130 kB`.
- `npx tsx --test components/search/DateStrip.test.tsx components/SearchResultsClient.test.tsx lib/analytics/webVitals.test.ts lib/flightFilters.test.ts app/api/search/lowest-fare/route.test.ts app/api/booking/hold/route.test.ts`: PASS 29/29.
- `npx tsc --noEmit --pretty false`: PASS.
- `npm run check:text`: PASS.
- `npx next build`: PASS.

## 6. Gợi ý test thủ công cho Opus 4.7

1. Mở Chrome DevTools > Application > Local Storage.
2. Kiểm tra `apg_search_page_state` không còn chứa `results`, `pairOptions`, `outboundResults`, `inboundResults`.
3. Kiểm tra `apg_airports_v1` nếu có thì nhỏ hơn 128 KB.
4. Search route lớn, giữ tab 10 phút, quan sát heap không tăng liên tục do localStorage stringify.
5. Trên mobile Safari/Chrome, thử chọn ô Từ/Đến nhiều lần.
6. Test quote cũ hết hạn: hệ thống refresh hoặc báo chọn lại chuyến, không tạo lỗi `UPSTREAM_UNAVAILABLE` mơ hồ.
7. Mở DevTools console ở development, kiểm tra log `[web-vitals]` xuất hiện sau khi page load.
8. Nếu muốn đo production, cấu hình `NEXT_PUBLIC_WEB_VITALS_ENDPOINT` rồi kiểm tra beacon payload.
9. Search route có nhiều chuyến, mở React Profiler để xác nhận mỗi row không còn khởi tạo hook `useAirports()`.
10. Test filter mới: chọn khung giờ “Sáng/Tối” và thời lượng “≤2h/>4h”, kiểm tra one-way, roundtrip legs và roundtrip pair view đều giảm đúng số kết quả.
11. Mở một vài trang public rồi vào `/admin/observability/web-vitals` bằng tài khoản `SUPER_ADMIN` hoặc `QUAN_LY_DAI_LY`, kiểm tra metric mới xuất hiện.
10. Chọn chuyến một chiều/khứ hồi, xác nhận dock tổng tạm tính vẫn hiện đúng và nút `Tiếp tục báo giá` vẫn mở `/quote`.
11. Kiểm tra logo airline trên danh sách kết quả và `/quote`; nếu ảnh proxy lỗi, fallback chữ hãng vẫn hiển thị.
12. Search khứ hồi, kiểm tra cả 2 mode `Gợi ý cặp vé` và `Tự chọn từng chiều` trên desktop.
13. Kiểm tra khứ hồi trên mobile: tab `Chiều đi`/`Chiều về`, chọn từng chiều, dock tổng vẫn cập nhật đúng.
14. Deploy Vercel preview rồi kiểm tra `/api/airline-logo/VJ?src=...`; route không được lỗi do ghi filesystem và vẫn trả ảnh/fallback đúng.
15. Search một chiều, kiểm tra filter hãng/dừng, sort giá/giờ, load-more và chọn/bỏ chọn chuyến trên desktop.
16. Search một chiều trên mobile, kiểm tra DateStrip, chọn chuyến, dock tổng và mở `/quote`.
17. Kiểm tra search form desktop: đổi một chiều/khứ hồi, đổi sân bay, quick routes, ngày đi/ngày về, passenger counters, cabin và nút tìm.
18. Kiểm tra search form mobile: mobile airport picker, swap route, ngày khứ hồi, passenger counters và trạng thái loading.
19. Kiểm tra hero/header: route summary cập nhật theo điểm đi/đến, badge `Tìm thấy` hiện sau search, click hero vẫn quay về `/`.
20. Reload homepage, kiểm tra Zustand/localStorage vẫn restore input nhẹ nhưng không restore search results/fare cũ.
21. Search route nhiều kết quả, load thêm nhiều lần và kiểm tra DOM nodes không tăng tuyến tính theo toàn bộ số chuyến do `react-window`.
22. Kiểm tra one-way/roundtrip pair/roundtrip legs sau khi scroll trong virtual list: chọn chuyến, bỏ chọn, dock tổng và `/quote` vẫn đúng.
23. Trên desktop/tablet, mở nút `Tháng` trong DateStrip, chọn một ngày có giá trong tháng và xác nhận URL/search date đổi đúng nhưng không reload lại lowest-fare khi chỉ mở calendar.
24. Sau khi chạy migration, mở vài trang public rồi vào `/admin/observability/web-vitals`; refresh/cold start vẫn còn dữ liệu vì dashboard đọc từ `WebVitalMetric`.
25. Xoá cache runtime `/tmp` hoặc deploy sang instance mới, gọi `/api/airline-logo/VJ?...`; logo vẫn có thể đọc lại từ `AirlineLogoCache`.
26. Với route có dữ liệu nhiều tháng, mở DateStrip > `Tháng`, chuyển qua các month tab và kiểm tra giá thấp nhất theo tháng/so sánh ±3 ngày hiển thị đúng.
