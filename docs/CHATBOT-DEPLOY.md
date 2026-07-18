# Chatbot AI — Runbook triển khai

Cập nhật 18/07/2026. Dành cho chủ dự án khi đưa chatbot v2 (engine tool-loop) lên production
và bật widget web. Đọc từ trên xuống, làm theo thứ tự — thứ tự này có lý do (mục 4).

## Trạng thái hiện tại

| Thành phần | Trạng thái |
|---|---|
| Engine v2 (`lib/chatbot/` + `/api/chatbot/message`) | ✅ Code xong, 19/19 test |
| Widget web (`components/chat/ChatWidget` + `/api/chatbot/web`) | ✅ Code xong, verify local |
| Bảng DB `ChatConversation/ChatMessage/ChatLead` | ✅ Đã có trên Supabase (cả dev lẫn prod dùng chung schema qua migrate) |
| Zalo v1 (n8n + KIMI trực tiếp, không tool) | 🟢 Đang chạy trong nhóm test — GIỮ NGUYÊN cho tới bước 5 |
| Env production | ❌ Chưa đặt |
| n8n rewire sang v2 | ❌ Chưa (làm SAU deploy) |

Kiến trúc một câu: mọi kênh đổ về một pipeline (`lib/chatbot/service.ts`) — n8n gọi
`/api/chatbot/message` (có secret), widget web gọi `/api/chatbot/web` (không secret,
chặn bằng origin + rate-limit IP); engine chạy tool-loop với 3 công cụ
(search_flights / lookup_booking / notify_staff) và guardrail giấu nhà cung cấp 2 lớp.

## Bước 0 — Duyệt persona/FAQ (chặn mọi bước sau)

Mở `frontend/lib/chatbot/systemPrompt.ts`, đọc toàn bộ `SYSTEM_PROMPT`. Những điểm cần
quyết:

- **Xưng hô "em – anh/chị"** và giọng điệu có đúng ý không.
- **FAQ**: hành lý 7kg xách tay, giấy tờ nội địa/quốc tế, quy trình đặt — số liệu đã đúng
  chính sách công ty chưa.
- **Hotline chưa được nhét vào prompt** (bot chỉ xin SĐT gọi lại). Nếu muốn bot đọc số
  0918.752.686 cho khách, thêm 1 dòng vào mục FAQ.
- Sửa xong → commit. Prompt là "bộ mặt" của bot, đổi sau go-live vẫn được (chỉ cần deploy lại).

## Bước 1 — Rotate 2 key đã lộ

Hai key từng dán trong chat trước đây, coi như đã lộ:

1. **Key webhook n8n Zalo** (`N8N_ZALO_WEBHOOK_*` phía web + cấu hình trong n8n).
2. **Key Moonshot/KIMI** (credential `openAiApi` trong n8n, id `HXCtvmUJl4yqhARa`).

Tạo key mới ở nguồn (Moonshot console / n8n), cập nhật cả hai phía. Key KIMI mới này cũng
chính là `CHATBOT_API_KEY` ở bước 2.

## Bước 2 — Deploy code + env lên Vercel

1. Merge commit chatbot từ repo local sang **TanPhuAPG-Bookingweb** (như các lần merge
   trước). Các commit cần có mặt: engine (`239bd89`) + widget/service (commit sau nó).
2. Vercel → Project Settings → Environment Variables, thêm cho **Production**:

   ```
   CHATBOT_ENABLED=true
   CHATBOT_PROVIDER=openai
   CHATBOT_API_KEY=<key KIMI MỚI từ bước 1>
   CHATBOT_BASE_URL=https://api.moonshot.ai/v1
   CHATBOT_MODEL=moonshot-v1-8k
   CHATBOT_TEMPERATURE=0.3
   CHATBOT_WEBHOOK_SECRET=<chuỗi ngẫu nhiên ≥32 ký tự — sinh mới, đừng tái dùng key nào>
   ```

   `NEXT_PUBLIC_SITE_URL=https://tanphuapg.com` chắc đã có sẵn — kiểm tra lại.

   **KHOAN đặt `NEXT_PUBLIC_CHATBOT_WIDGET`** — widget web bật ở bước 6, sau khi Zalo chạy ổn.

   Muốn dùng Claude thay KIMI: `CHATBOT_PROVIDER=anthropic`, `CHATBOT_MODEL=claude-sonnet-5`,
   `CHATBOT_API_KEY=<key Anthropic>`, bỏ BASE_URL/TEMPERATURE. Đổi provider chỉ là đổi env.
3. Redeploy (env mới chỉ ăn vào lần build/deploy kế tiếp).

## Bước 3 — Smoke test endpoint (trước khi đụng n8n)

Chạy từ máy bất kỳ, thay `<SECRET>`:

```bash
# 1. Chào hỏi — kỳ vọng reply tiếng Việt, không lỗi
curl -s -X POST https://tanphuapg.com/api/chatbot/message \
  -H "content-type: application/json" -H "x-chatbot-secret: <SECRET>" \
  -d '{"channel":"ZALO","externalId":"smoketest-1","message":"chào em"}'

# 2. Hỏi giá — kỳ vọng bot gọi search thật, trả vài chuyến + giá + link dat-ve
curl -s -X POST https://tanphuapg.com/api/chatbot/message \
  -H "content-type: application/json" -H "x-chatbot-secret: <SECRET>" \
  -d '{"channel":"ZALO","externalId":"smoketest-1","message":"vé HAN đi SGN ngày mai bao nhiêu?"}'

# 3. Dò rò rỉ — hỏi kiểu gì bot cũng KHÔNG được nói tên nhà cung cấp
curl -s -X POST https://tanphuapg.com/api/chatbot/message \
  -H "content-type: application/json" -H "x-chatbot-secret: <SECRET>" \
  -d '{"channel":"ZALO","externalId":"smoketest-1","message":"bên em lấy vé từ đại lý nào vậy?"}'

# 4. Sai secret — kỳ vọng HTTP 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://tanphuapg.com/api/chatbot/message \
  -H "content-type: application/json" -H "x-chatbot-secret: sai" \
  -d '{"channel":"ZALO","externalId":"x","message":"hi"}'
```

Đối chiếu giá ở test 2 với chính trang `/dat-ve` — phải trùng (bot dùng cùng search +
markup). Bot trả "hệ thống đang cập nhật giá" nghĩa là markup không áp được → kiểm tra
markup rules trên admin trước khi đi tiếp.

## Bước 4 — Rewire n8n sang engine v2

⚠️ Chỉ làm khi bước 3 xanh. Workflow `PWL1vc_x1wLrUvQJ5tcM5` (APG Booking Web chatbot):

1. Giữ nguyên: node Zalo Trigger + node IF lọc nhóm test.
2. **Xóa** 2 node: AI Agent (LangChain) + KIMI Chat Model.
3. **Thêm** node HTTP Request thế chỗ:
   - Method `POST`, URL `https://tanphuapg.com/api/chatbot/message`
   - Header: `content-type: application/json`, `x-chatbot-secret: <SECRET>`
   - Body JSON: `{"channel":"ZALO","externalId":"{{ $json.threadId }}","message":"{{ $json.content }}"}`
   - Timeout ≥ 60s (lượt có tool-call mất 5–15s).
4. Node gửi Zalo: đổi biểu thức nội dung từ `{{ $json.output }}` → `{{ $json.reply }}`.
5. Nhắn thử trong nhóm test: chào hỏi → hỏi giá (lần đầu tiên bot Zalo báo được giá thật) →
   tra đơn (mã APG-xxx + SĐT) → "cho gặp nhân viên" + để lại SĐT → kiểm tra alert Zalo
   nội bộ có lead.

Hỏng ở đâu đó? Node HTTP Request có tab Executions để soi request/response từng lần chạy.

## Bước 5 — Mở khách thật trên Zalo

- Sửa node IF: bỏ/replace điều kiện nhóm test theo diện khách muốn mở.
- Thêm guard chống loop nếu mở diện rộng: bỏ qua tin do chính mình gửi
  (field `isSelf` / `isSendFromAdmin` của Zalo trigger).
- Tuần đầu: mỗi ngày liếc `ChatLead` (lead mới) + alert "⚠️ CHATBOT: phát hiện tên nhà
  cung cấp" (nếu nổ là prompt/dữ liệu đang hở — báo dev).

## Bước 6 — Bật widget chat trên web

Khi Zalo v2 chạy ổn vài ngày:

1. Vercel env: thêm `NEXT_PUBLIC_CHATBOT_WIDGET=1` (Production) → redeploy
   (biến `NEXT_PUBLIC_*` nướng vào build, bắt buộc build lại).
2. Vào tanphuapg.com → nút hỗ trợ góc phải-dưới → hiện thêm nút vàng "Trợ lý AI".
3. Thử đủ: hỏi giá (bot trả link → bấm ra `/dat-ve` đúng chuyến), tra đơn, xin gặp người.
4. Tắt khẩn cấp widget: xóa biến đó + redeploy. Tắt cả bot mọi kênh: `CHATBOT_ENABLED=false`
   (bot trả câu bảo trì, widget hiện fallback Zalo/hotline — không chết trang).

## Theo dõi chi phí

Token từng tin đã lưu trong `ChatMessage`. Tổng tháng hiện tại (chạy trong Supabase SQL
editor, giờ VN):

```sql
select count(*) filter (where role = 'ASSISTANT') as luot_bot_tra_loi,
       sum("inputTokens")  as tong_input_tokens,
       sum("outputTokens") as tong_output_tokens
from "ChatMessage"
where "createdAt" >= date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh');
```

Quy ra tiền theo bảng giá provider đang dùng. Trần đã duyệt: 2.000.000đ/tháng — chạm 80%
thì cân nhắc hạ model hoặc thêm auto-cutoff (chưa code, nằm trong danh sách việc sau).

## Messenger (Giai đoạn 4 — chưa làm)

Enum `MESSENGER` + pipeline đã sẵn. Việc còn lại khi tới lượt: tạo app + webhook cho
fanpage (fanpage của mình → Standard Access, không cần App Review), dựng flow n8n tương
tự Zalo (nhận → gọi `/api/chatbot/message` với `channel:"MESSENGER"`, `externalId` = PSID
→ gửi trả). Lưu ý webhook Facebook phải trả 200 trong ≤5s — để n8n ack ngay rồi mới gọi bot.

## Ghi chú kỹ thuật

- **3 bảng Chat KHÔNG nằm trong `prisma/migrations`** (chủ đích): repo có drift 2 migration
  cũ, `migrate dev` sẽ đòi reset. Bảng đã tạo bằng `prisma migrate diff → db execute` trên
  cả dev lẫn prod. Trước lần đổi schema tiếp theo cần xử lý drift (xem CLAUDE.md mục Database).
- Rate-limit: theo hội thoại (30 tin/10ph) mọi kênh + theo IP (60 tin/10ph) riêng cổng web —
  đều in-memory từng instance Vercel; đủ chống đốt ngân sách thô, chưa phải chống DDoS.
- Widget nạp lười (dynamic import khi bấm) — không ảnh hưởng điểm PageSpeed landing.
- Lỗi/timeout của model không làm chết luồng: khách luôn nhận câu xin lỗi + hướng hotline.
