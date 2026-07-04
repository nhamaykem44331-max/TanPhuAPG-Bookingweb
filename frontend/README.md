# booktanphuapg local Nam Thanh setup

Ứng dụng này dùng backend local `namthanh-auto-login` để gọi Nam Thanh/Muadi thật cho các luồng tìm vé, báo giá và giữ chỗ.

## 1. Chạy backend Nam Thanh

Mở terminal tại:

```powershell
F:\Làm việc Ai\namthanh-auto update claude\namthanh-auto-login
```

Chạy OCR server:

```powershell
npm run ocr
```

Mở terminal thứ hai trong cùng thư mục:

```powershell
npm run login
npm run api
```

Kiểm tra backend:

```powershell
Invoke-RestMethod http://localhost:3100/health
```

Backend sẽ đọc `session/storage-state.json`, thử refresh Muadi token qua `auth/refresh-token`, và ghi lại `accessToken`/`refreshToken` mới vào cùng file session. Nếu refresh không thành công ở các request an toàn, backend có thể login lại một lần. Luồng tạo booking vẫn giữ retry có kiểm soát để tránh tạo trùng PNR.

## 2. Chạy booktanphuapg

Mở terminal tại:

```powershell
F:\Làm việc Ai\booktanphuapg
```

Tạo `.env.local` nếu cần:

```powershell
Copy-Item .env.example .env.local
```

Cài dependencies và chạy:

```powershell
npm install
npm run dev
```

Mở:

```txt
http://localhost:3000
```

## 3. Test tìm giá

Trên trang chủ:

1. Chọn hành trình và ngày bay.
2. Bấm `Tìm vé`.
3. Giá trả về từ `/api/search` là giá Nam Thanh/Muadi đầy đủ, gồm thuế và phí.

API test:

```powershell
$body = @{
  from = "HAN"
  to = "CXR"
  date = "2026-04-30"
  adults = 1
  children = 0
  infants = 0
  cabin = "economy"
  tripType = "oneway"
} | ConvertTo-Json

Invoke-RestMethod http://localhost:3000/api/search `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

## 4. Test giữ chỗ

Từ giao diện:

1. Tìm chuyến bay.
2. Bấm `Chọn` ở chuyến muốn lấy.
3. Trang quote sẽ mở ra.
4. Bấm `Giữ chỗ`.
5. Nhập tên hành khách, ví dụ `MR NGUYỄN VĂN A`.
6. Để ô xác nhận chưa tick nếu chỉ muốn kiểm tra thử.
7. Bấm `Kiểm tra thử`.

Để tạo PNR thật, tick ô xác nhận màu đỏ rồi bấm `Tạo PNR thật`.

UI gọi:

```txt
POST /api/booking/hold
```

Route này proxy sang:

```txt
POST http://localhost:3100/bookings/hold
```

Mặc định an toàn: các API giữ chỗ chạy ở chế độ kiểm tra thử nếu không truyền rõ `dryRun=false`.

## 5. Quy tắc mã hóa tiếng Việt

Từ bây giờ, dự án dùng quy tắc cố định sau:

1. Mọi file mã nguồn, tài liệu và text hiển thị cho người dùng phải lưu bằng **UTF-8**.
2. Mọi câu tiếng Việt hiển thị trên UI hoặc trả về qua API phải viết **đầy đủ dấu tiếng Việt**, không dùng bản không dấu.
3. Không commit chuỗi bị lỗi mã hóa kiểu `Ã`, `â`, `Ä`, `á»...`, hoặc ký tự thay thế `�`.
4. Khi sửa file có text tiếng Việt, phải kiểm tra lại ở browser hoặc response thực tế để chắc không bị mojibake.
5. Không dùng cách suy luận text từ chuỗi đã lỗi mã hóa; phải sửa trực tiếp source gốc.

Nếu phát hiện chuỗi hiển thị sai tiếng Việt, phải sửa ngay trong cùng nhánh trước khi tiếp tục các thay đổi khác.

## 6. Kiểm tra nhanh trước khi commit

Chạy lệnh sau để quét các chuỗi lỗi mã hóa tiếng Việt trong source:

```powershell
npm run check:text
```

Lệnh này sẽ báo lỗi nếu phát hiện các chuỗi mojibake phổ biến trong `app/`, `components/` hoặc `lib/`.
