# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Project-specific notes (Web Đặt vé APG)

- Frontend: Next.js 14 App Router (`frontend/`, port 3000). Backend auto-login Node (port 3100). Python OCR sidecar (port 8001).
- Preview (`.claude/launch.json`) runs `next start` (production build) — source edits need a rebuild to show; for live tuning switch `runtimeArgs` to `run dev`, then revert.
- Landing CSS is scoped under `.lp`; the landing header uses the `.apgx-topnav` pattern.

### Database — ĐỌC KỸ TRƯỚC KHI CHẠY BẤT KỲ LỆNH PRISMA NÀO

Ngày 14/07/2026 một lệnh Prisma trỏ nhầm DB production đã **xoá sạch** markup rules, tài
khoản admin và toàn bộ đơn/khách. Từ 16/07 dev và prod đã tách đôi:

| | Supabase project | File env | Vai trò |
|---|---|---|---|
| **DEV** | `whqustexrkcecogbhuqu` (ap-northeast-2) | `.env.local` ← mặc định | Nghịch thoải mái, reset vô tư |
| **PROD** | `scwpkgbuibexhefjzngg` (ap-southeast-1) | `.env.prod-ops.local` | Đơn thật, tiền thật. KHÔNG tự động load |

**Quy tắc bất di bất dịch:**
- Sửa schema → `npm run db:migrate:dev` (chạy trên DEV, sinh file migration) → commit migration.
- Đưa lên prod → **chỉ** `npm run db:migrate:deploy` (chỉ áp migration mới, không bao giờ reset).
- **KHÔNG BAO GIỜ** `migrate dev` / `db push` / `migrate reset` trỏ prod. `scripts/db-guarded.js`
  sẽ chặn (nhận diện ref prod trong `DATABASE_URL`); chỉ vượt qua bằng `ALLOW_PROD_DB=1` — cân nhắc rất kỹ.
- Thao tác dữ liệu prod có chủ đích: `npx dotenv -e .env.prod-ops.local -- node script.js`, và
  script nên tự kiểm tra ref DB trước khi ghi.
- Vercel build (`prisma generate && next build`) KHÔNG chạy migration → phải áp migration thủ công.
