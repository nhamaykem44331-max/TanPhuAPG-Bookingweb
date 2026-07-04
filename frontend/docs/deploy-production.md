# Production Deploy Runbook

Tai lieu nay la checklist deploy production cho du an Tan Phu APG Booking Web.
Khong dua mat khau, API key, token, hoac connection string day du vao git. Moi gia tri nhay cam phai nam trong Vercel, Render, Supabase hoac file local `.env.local` da duoc gitignore.

## 1. He thong production

- Frontend: Vercel project `tan-phu-apg-bookingweb`
- Frontend URL: `https://tan-phu-apg-bookingweb.vercel.app`
- Frontend repo: `https://github.com/nhamaykem44331-max/TanPhuAPG-Bookingweb`
- Backend Nam Thanh: Render service `nt-auto-login`
- Backend URL: `https://nt-auto-login.onrender.com`
- Backend repo: `https://github.com/nhamaykem44331-max/nt-auto-login`
- Database: Supabase Postgres, accessed by Prisma.

Deploy thu tu an toan:

1. Deploy backend Render.
2. Kiem tra backend `/health`.
3. Cap nhat env frontend Vercel.
4. Redeploy frontend Vercel.
5. Test search, dry-run hold, login admin, sau do moi test PNR that.

## 2. Frontend Vercel env vars

Bat buoc cho production:

```env
DATABASE_URL="<SUPABASE_POOLER_URL>"
DIRECT_URL="<SUPABASE_DIRECT_OR_POOLER_URL>"

NAMTHANH_BACKEND_URL="https://nt-auto-login.onrender.com"
NAMTHANH_BACKEND_API_KEY="<SAME_VALUE_AS_RENDER_BACKEND_API_KEY>"

NEXTAUTH_URL="https://tan-phu-apg-bookingweb.vercel.app"
NEXTAUTH_SECRET="<AUTH_SECRET_VALUE>"
AUTH_SECRET="<SAME_VALUE_AS_NEXTAUTH_SECRET>"

API_SECRET_KEY="<INTERNAL_API_SECRET>"
NODE_ENV="production"
```

Optional, chi bat neu dung tinh nang tuong ung:

```env
UPSTASH_REDIS_REST_URL="<UPSTASH_URL>"
UPSTASH_REDIS_REST_TOKEN="<UPSTASH_TOKEN>"

PAYOS_CLIENT_ID="<PAYOS_CLIENT_ID>"
PAYOS_API_KEY="<PAYOS_API_KEY>"
PAYOS_CHECKSUM_KEY="<PAYOS_CHECKSUM_KEY>"
PAYOS_LOG_LEVEL="warn"
PAYOS_RETURN_URL="https://tan-phu-apg-bookingweb.vercel.app/admin/bookings/{bookingId}?payment=success"
PAYOS_CANCEL_URL="https://tan-phu-apg-bookingweb.vercel.app/admin/bookings/{bookingId}?payment=cancelled"
PAYOS_WEBHOOK_URL="https://tan-phu-apg-bookingweb.vercel.app/api/webhooks/payos"

SMTP_HOST="<SMTP_HOST>"
SMTP_PORT="587"
SMTP_USER="<SMTP_USER>"
SMTP_PASS="<SMTP_PASS>"
EMAIL_FROM="noreply@tanphuapg.com"
EMAIL_REPLY_TO="support@tanphuapg.com"
NOTIFICATIONS_EMAIL_ENABLED="false"
NOTIFICATIONS_SLACK_ENABLED="false"
NOTIFICATIONS_TELEGRAM_ENABLED="false"
CRON_SECRET="<CRON_SECRET>"
```

Ghi chu Supabase:

- `DATABASE_URL` la chuoi runtime Prisma. Nen dung connection string tu Supabase pooler.
- Neu mat khau DB co ky tu dac biet nhu `@`, phai URL encode thanh `%40`.
- `DIRECT_URL` dung cho Prisma migrate/direct connection. Neu chua co direct URL, co the tam thoi dung cung pooler URL tren Vercel runtime, nhung khi chay migrate nen dung direct connection tu Supabase dashboard.
- Khong can `SUPABASE_URL`/`SUPABASE_ANON_KEY` neu code hien tai chi truy cap DB qua Prisma.

Sau khi them/sua env tren Vercel, phai vao `Deployments` va `Redeploy`. Ban production dang chay khong tu nhan env moi.

## 3. Backend Render env vars

Render service `nt-auto-login` dung repo backend rieng. Env bat buoc:

```env
NODE_ENV="production"
HEADLESS="true"
LOGIN_SKIP_SCREENSHOTS="true"
BACKEND_ALLOW_NO_AUTH="false"
BACKEND_API_KEY="<BACKEND_API_KEY>"

NAMTHANH_USERNAME="<NAM_THANH_USERNAME>"
NAMTHANH_PASSWORD="<NAM_THANH_PASSWORD>"
NAMTHANH_AGENCY_CODE="<NAM_THANH_AGENCY_CODE>"

MUADI_AES_KEY="<MUADI_AES_KEY>"
MUADI_AES_IV="<MUADI_AES_IV>"

DDDDOCR_API_URL="http://127.0.0.1:8001"
```

Neu gan persistent disk tren Render:

```env
SESSION_FILE="/var/data/session/storage-state.json"
SCREENSHOT_DIR="/var/data/screenshots"
```

Neu khong co disk, backend van chay nhung session Nam Thanh se mat sau restart/redeploy va phai login lai.

## 4. Render service settings

Service type:

- Runtime: Docker
- Branch: `main`
- Root Directory: blank
- Region: Singapore
- Health Check Path: `/health`
- Auto-Deploy: On Commit

Advanced Docker:

- Docker Build Context Directory: `.`
- Dockerfile Path: `./Dockerfile`
- Docker Command: blank
- Pre-Deploy Command: blank
- Registry Credential: No credential

Loi tung gap:

- `stat /opt/render/project/src/Dockerfile: not a directory`
  - Nguyen nhan: `dockerContext` bi set thanh `./Dockerfile`.
  - Fix: Docker Build Context Directory phai la `.`, Dockerfile Path la `./Dockerfile`.
- `/bin/sh: 1: pip3: not found`
  - Fix trong backend Dockerfile: cai `python3-pip` truoc khi `python3 -m pip install flask ddddocr`.
- Playwright bao `required: mcr.microsoft.com/playwright:vX`
  - Fix: dong bo version Docker base image voi version `playwright` trong `package-lock.json`.

## 5. Prisma/Supabase

Kiem tra ket noi DB:

```powershell
$env:DATABASE_URL="<SUPABASE_DATABASE_URL>"
"SELECT 1;" | npx prisma db execute --stdin --url $env:DATABASE_URL
```

Kiem tra migrations:

```powershell
$env:DATABASE_URL="<SUPABASE_DATABASE_URL>"
$env:DIRECT_URL="<SUPABASE_DIRECT_URL_OR_DATABASE_URL>"
npx prisma migrate status --schema prisma/schema.prisma
```

Deploy migrations khi can:

```powershell
$env:DATABASE_URL="<SUPABASE_DATABASE_URL>"
$env:DIRECT_URL="<SUPABASE_DIRECT_URL>"
npx prisma migrate deploy --schema prisma/schema.prisma
```

Seed super admin/markup rule khi DB moi:

```powershell
$env:DATABASE_URL="<SUPABASE_DATABASE_URL>"
$env:DIRECT_URL="<SUPABASE_DIRECT_URL_OR_DATABASE_URL>"
$env:SEED_SUPER_ADMIN_EMAIL="<ADMIN_EMAIL>"
$env:SEED_SUPER_ADMIN_PASSWORD="<ADMIN_PASSWORD>"
$env:SEED_SUPER_ADMIN_NAME="Super Admin"
npx prisma db seed
```

Luu y: seed hien tai chi tao Super Admin neu bang `User` dang rong. Neu DB da co user, can tao/cap nhat user bang admin UI hoac script rieng.

Kiem tra user Super Admin trong production DB:

```powershell
$env:DATABASE_URL="<SUPABASE_DATABASE_URL>"
@'
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();
(async () => {
  const email = "<ADMIN_EMAIL>";
  const password = "<ADMIN_PASSWORD>";
  const user = await prisma.user.findUnique({
    where: { email },
    select: { email: true, role: true, active: true, passwordHash: true },
  });
  console.log({
    exists: !!user,
    role: user?.role,
    active: user?.active,
    passwordMatches: user ? await bcrypt.compare(password, user.passwordHash) : false,
  });
})().finally(() => prisma.$disconnect());
'@ | node -
```

## 6. Kiem tra sau deploy

Backend Render:

```powershell
Invoke-RestMethod https://nt-auto-login.onrender.com/health
```

Ket qua tot can co:

- `auth: "api-key-required"`
- `ocr.reachable: true`
- `session.exists: true`
- `session.ok: true`

Frontend Vercel basic:

```powershell
Invoke-RestMethod https://tan-phu-apg-bookingweb.vercel.app/api/auth/session
Invoke-RestMethod https://tan-phu-apg-bookingweb.vercel.app/api/auth/csrf
Invoke-RestMethod https://tan-phu-apg-bookingweb.vercel.app/api/warmup
```

Neu `/api/auth/session` hoac `/api/auth/csrf` tra 500 voi message `There was a problem with the server configuration`, kiem tra:

- `NEXTAUTH_SECRET` da co chua.
- `AUTH_SECRET` da co chua.
- Hai secret co cung gia tri khong.
- Da redeploy Vercel sau khi them env chua.

Test search production:

```powershell
$body = @{
  from = "HAN"
  to = "DAD"
  date = "2026-05-05"
  returnDate = "2026-05-12"
  tripType = "roundtrip"
  adults = 1
  children = 0
  infants = 0
  cabin = "economy"
} | ConvertTo-Json

Invoke-RestMethod https://tan-phu-apg-bookingweb.vercel.app/api/search `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

Test hold an toan:

- Dung UI va bo tick `Tao PNR that`, hoac goi `/api/booking/hold` voi `dryRun: true`.
- Dry-run phai pass truoc khi tao PNR that.
- Khong test PNR that neu chua can thiet vi co the tao ma dat cho that tren Nam Thanh.

## 7. Troubleshooting nhanh

`UPSTREAM_UNAVAILABLE` tren hold:

- Neu detail co `Environment variable not found: DATABASE_URL`: Vercel thieu `DATABASE_URL` hoac chua redeploy.
- Neu detail co `Nam Thanh backend timeout`: backend Render cham, Nam Thanh/Muadi timeout, hoac flow hold dang cho ticket-info.
- Neu detail co `Backend auth not configured`: Render thieu `BACKEND_API_KEY` hoac `BACKEND_ALLOW_NO_AUTH` sai.
- Neu frontend search duoc nhung hold fail: kiem tra `/api/booking/hold` detail va Render logs cho `/bookings/hold`.

Admin login loi server configuration:

- Thu `/api/auth/session` va `/api/auth/csrf`.
- Neu deu 500: thieu `AUTH_SECRET`/`NEXTAUTH_SECRET` hoac chua redeploy.
- Neu auth endpoints OK nhung login fail: kiem tra user trong Supabase `User.active`, `role`, va `passwordHash`.

Frontend van goi localhost:

- Vercel thieu `NAMTHANH_BACKEND_URL`.
- Gia tri dung: `https://nt-auto-login.onrender.com`.
- Redeploy sau khi them env.

Render health `session.ok=false`:

- Goi `GET /session/ensure` voi header `X-API-Key`.
- Kiem tra logs `[warmup]`.
- Neu Playwright error version mismatch, dong bo Docker image version.
- Neu OCR fail, kiem tra `DDDDOCR_API_URL=http://127.0.0.1:8001` va process `ocr_server.py`.

## 8. Bao mat sau moi phien deploy

- Revoke/rotate Render API key neu da chia se trong chat.
- Revoke/rotate Vercel token neu da chia se trong chat.
- Khong commit `.env.local`, session, screenshots, debug logs.
- Neu da lo secret trong chat hoac anh chup man hinh cong khai, nen rotate secret do tren he thong goc.

