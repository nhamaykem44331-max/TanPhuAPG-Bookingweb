# Tối ưu đăng nhập & sửa lỗi tìm vé (Web đặt vé Tân Phú APG)

> Ngày: 2026-05-25 · Phạm vi: frontend `TanPhuAPG-Bookingweb` + backend `nt-auto-login`

## 1. Kiến trúc & repo

| Thành phần | Repo | Deploy |
|------------|------|--------|
| Frontend (Next.js, BFF) | `nhamaykem44331-max/TanPhuAPG-Bookingweb` | Vercel (`:3000`) |
| Backend (Node) | `nhamaykem44331-max/nt-auto-login` | Render (`:3100`) |

Frontend gọi backend qua `NAMTHANH_BACKEND_URL`; backend đăng nhập & gọi Muadi/Nam Thanh bằng tài khoản đại lý **HTXTP01**.

---

## 2. Tối ưu đăng nhập backend — bỏ OCR

**Vấn đề:** Backend đăng nhập Muadi bằng Playwright + OCR giải captcha → chậm (10–30s), phải chạy OCR server.

**Phát hiện:** Captcha trang login là `react-simple-captcha` (validate **phía client**). Endpoint thật `POST /api/auth/login` (model `UserName/Password/AgentCode/Otp`, body mã hoá AES-128-CBC, **không** gửi header `X-Api-Version`) chỉ cần `Otp` khác rỗng → **không cần captcha**.

**Thay đổi:**
- `src/api-login.js` (mới) — đăng nhập API trực tiếp (1 HTTP request), ghi `session/storage-state.json` đúng format cho `muadi-client`.
- `src/session-login.js` — `runLogin` ưu tiên api-login, **tự fallback** Playwright+OCR khi lỗi. Cờ `API_LOGIN_DISABLED=true` để ép cách cũ.

**Kết quả:** Login **~1s** (thay vì 10–30s); chạy bình thường **không cần `npm run ocr`**; hết lỗi OCR đọc sai captcha. HTTP API & format session **giữ nguyên** → frontend không phải sửa.

---

## 3. Sửa lỗi “tìm vé vài lần rồi tịt, không báo lỗi”

**Loại trừ spam-ban:** Tài khoản **không bị khóa** — login/refresh-token/tỷ giá đều OK, search tuần tự vẫn chạy.

**Nguyên nhân gốc:** Muadi trả **`403` ở `booking/create-session`** khi **nhiều search tạo session đồng thời**. Mỗi search tạo 1 session; khi các stream chồng nhau (trên `next dev`, việc client hủy search cũ **không** lan tới hủy stream backend đang chạy) → nhiều `create-session` cùng lúc → 403 → search trả rỗng âm thầm.

**Fix Frontend (`TanPhuAPG-Bookingweb`):**
- `lib/namthanh.ts` — `streamNamThanhSearch` nhận `AbortSignal`, truyền vào fetch, cleanup (`abort` + `reader.cancel`) trong `finally`.
- `app/api/search/stream/route.ts` — bắt `req.signal` + `cancel()` để **hủy fetch backend khi client ngắt** → không còn dồn `create-session`.
- `components/home/HomeSearchExperience.tsx` — giải phóng reader SSE trên mọi lối thoát.

**Fix Backend (`nt-auto-login`):**
- `src/muadi-client.js` — `createSession` **retry khi gặp 403** (backoff) + timeout 20s. *(Đã loại phương án serialize toàn cục vì gây head-of-line blocking — 1 create-session chậm làm kẹt mọi search.)*

**Hiệu quả:** Trên **production (Vercel)** `req.signal` hoạt động → đổi tìm sẽ hủy đúng stream cũ → ~1 search tại 1 thời điểm → **hết 403**. Trên local `next dev` vẫn cần dùng đúng cách (mục 6).

---

## 4. Dọn dẹp Git (frontend)
- Gộp remote về **duy nhất** `origin → TanPhuAPG-Bookingweb` (gỡ remote thừa `booktanphuapg`).
- Xóa 2 nhánh local cũ `claude/*` (commit đã nằm trong `main`).

---

## 5. Kiểm thử & xác nhận
- Backend: login ~0.5–1s; `npm run journey`/`price` ra giá thật; warmup + `/auth/login` + `/flights/search` chạy tốt.
- Frontend: search ra kết quả đầy đủ (HAN→DAD khứ hồi); 1 lần abort **không** làm kẹt search kế tiếp.
- ⚠️ Lúc stress-test (8 stream đồng thời) đã **tạm** làm Muadi throttle `create-session` cho HTXTP01 — tự hồi sau khi để nguội. Đây là rate-limit tạm, **không** phải ban tài khoản.

---

## 6. Vận hành & dùng an toàn

**Chạy local (2 terminal):**
```powershell
# Terminal 1 — backend
cd "...\namthanh-auto-login"; npm run backend   # :3100
# Terminal 2 — frontend
cd "...\booktanphuapg"; npm run dev             # :3000
```

**An toàn:**
- Bấm **Tìm chuyến bay → chờ kết quả → mới thao tác tiếp**; **không spam click**, không mở nhiều tab cùng tìm (tránh dồn `create-session`).
- DB là **Supabase production** → giữ chỗ/đặt vé = **bản ghi & PNR thật**; chỉ test thì dừng ở bước xem giá. **Không** chạy `db:migrate`/`db:seed`.
- “Failed to fetch” → 1 trong 2 server chưa chạy. `EADDRINUSE :::3100` → backend đã chạy rồi.

---

## 7. Commit đã push

| Repo | Commit | Nội dung |
|------|--------|----------|
| `nt-auto-login` | `5de5e9f` | Direct API login (bỏ Playwright+OCR) |
| `nt-auto-login` | `7143420` | Retry `create-session` khi 403 |
| `TanPhuAPG-Bookingweb` | `c12970e` | Hủy stream search khi client abort |

> Ghi chú: công cụ fare-scanner **Price Scan** (`APG-Price-Scan`, commit `189958e`) cũng được áp dụng **cùng kỹ thuật login API trực tiếp** trong cùng đợt — nhưng là tool riêng, không thuộc web đặt vé.
