# UptimeRobot keep-alive setup

Tai lieu nay huong dan tao monitor mien phi de ping backend Nam Thanh dinh ky,
giup giam loi cold start tren Render free tier va gui email khi backend 502/503.

## 1. Dang ky UptimeRobot

1. Vao https://uptimerobot.com va tao tai khoan mien phi.
2. Xac nhan email neu UptimeRobot yeu cau.
3. Dang nhap vao dashboard UptimeRobot.

## 2. Tao HTTP(s) monitor

1. Chon `New Monitor`.
2. Chon monitor type `HTTP(s)`.
3. Dien thong tin:
   - Friendly Name: `Tan Phu APG Nam Thanh Backend`
   - URL: `https://nt-auto-login.onrender.com/health`
   - Monitoring Interval: `5 minutes`
   - Timeout: `30 seconds`
4. Trong phan Alert Contacts, chon email cua admin/user dang van hanh he thong.
   Khong hardcode email vao repo.
5. Luu monitor.

## 3. Verify sau khi save

1. Mo monitor vua tao va kiem tra status la `Up` hoac `Monitoring`.
2. Bam refresh/check neu dashboard cho phep.
3. Goi thu endpoint bang trinh duyet:

```text
https://nt-auto-login.onrender.com/health
```

Ket qua tot can co:

- `auth: "api-key-required"`
- `ocr.reachable: true`
- `session.exists: true`
- `session.ok: true`

## 4. Luu y van hanh

- Endpoint `/health` la public, khong can header `X-API-Key`.
- UptimeRobot free ping 5 phut/lap la du de giu backend am trong phan lon
  truong hop Render free tier sleep sau idle.
- Khi backend tra 502/503, UptimeRobot se gui email alert. Admin nen kiem tra
  Render service va goi re-login session manual neu health bao `session.ok=false`.
- Khong dua `BACKEND_API_KEY`, Render API key, Vercel token, Nam Thanh password,
  session file, hoac screenshot debug vao UptimeRobot notes hay vao git.
