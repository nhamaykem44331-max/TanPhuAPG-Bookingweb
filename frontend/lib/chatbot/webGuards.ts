// Guard cho cổng chatbot web (/api/chatbot/web) — route public không có secret.
//
// Khác cổng n8n: caller là trình duyệt thật nên (1) chặn cross-origin để site khác
// không mượn bot đốt ngân sách, (2) rate-limit THEO IP có ý nghĩa (mỗi khách 1 IP,
// không như bot server-side), (3) ép định dạng anonId để không nhét chuỗi tuỳ ý vào DB.
// Hàm thuần, tách khỏi route để test không cần dựng HTTP.

/** anonId hợp lệ: "web_" + 16–64 ký tự [a-z0-9] (widget sinh từ crypto.randomUUID). */
export function isValidAnonId(value: string): boolean {
  return /^web_[a-z0-9]{16,64}$/.test(value);
}

/**
 * Origin/Referer có thuộc site mình không. So HOSTNAME (bỏ port) giữa origin của
 * request và host đang phục vụ + NEXT_PUBLIC_SITE_URL — cover cả localhost/preview.
 * Không có cả Origin lẫn Referer → chặn (trình duyệt luôn gửi Origin cho fetch POST).
 */
export function isAllowedWebOrigin(
  originHeader: string | null,
  refererHeader: string | null,
  requestHost: string | null,
  siteUrl: string | undefined,
): boolean {
  const raw = originHeader || refererHeader;
  if (!raw) return false;

  let originHost: string;
  try {
    originHost = new URL(raw).hostname.toLowerCase();
  } catch {
    return false;
  }

  const allowed = new Set<string>();
  if (requestHost) allowed.add(requestHost.split(":")[0].toLowerCase());
  if (siteUrl) {
    try {
      allowed.add(new URL(siteUrl).hostname.toLowerCase());
    } catch {
      /* NEXT_PUBLIC_SITE_URL hỏng thì bỏ qua, còn requestHost */
    }
  }
  return allowed.has(originHost);
}

// Rate-limit theo IP, in-memory theo instance (đủ cho lớp chống đốt ngân sách thô;
// per-hội-thoại đã có ở service). Cửa sổ 10 phút, trần cao hơn per-convo một chút
// để 1 nhà nhiều người dùng chung IP không khoá nhau oan.
const ipBucket = new Map<string, { count: number; resetAt: number }>();
const IP_LIMIT = 60;
const IP_WINDOW_MS = 10 * 60_000;
const IP_BUCKET_MAX = 10_000; // chống phình bộ nhớ khi bị quét IP giả

export function ipRateLimited(ip: string, now = Date.now()): boolean {
  const entry = ipBucket.get(ip);
  if (!entry || now > entry.resetAt) {
    if (ipBucket.size >= IP_BUCKET_MAX) ipBucket.clear();
    ipBucket.set(ip, { count: 1, resetAt: now + IP_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > IP_LIMIT;
}

/** Độ dài tin tối đa từ widget — dài hơn là bất thường (UI giới hạn sẵn). */
export const WEB_MESSAGE_MAX_LENGTH = 1000;
