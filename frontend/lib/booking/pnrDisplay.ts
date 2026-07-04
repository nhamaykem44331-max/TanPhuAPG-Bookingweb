// Ẩn ngôn ngữ kỹ thuật của đối tác (Nam Thanh/GDS) khỏi mặt khách và map sang tiếng Việt thân thiện.

const KNOWN_PARTNER_ISSUES: Array<[RegExp, string]> = [
  [/date of birth is not valid/i, "Ngày sinh chưa khớp loại hành khách — cần kiểm tra lại"],
  [/sold ?out|no ?seat|unavailable|not available/i, "Hết chỗ ở mức giá này"],
  [/timeout|timed out|too slow/i, "Quá thời gian xử lý — vui lòng liên hệ hotline"],
  [/invalid|error|failed|not permitted/i, "Cần kiểm tra — vui lòng liên hệ hotline 0918.752.686"],
];

/** true nếu là mã PNR thật (5–8 ký tự chữ/số), không phải chuỗi lỗi. */
export function isRealPnr(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[A-Z0-9]{5,8}$/.test(value.trim().toUpperCase());
}

/** Trả thông báo tiếng Việt nếu giá trị KHÔNG phải PNR thật (là lỗi/status thô); null nếu là PNR hợp lệ hoặc rỗng. */
export function friendlyPnrIssue(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw || isRealPnr(raw)) return null;
  for (const [re, msg] of KNOWN_PARTNER_ISSUES) {
    if (re.test(raw)) return msg;
  }
  return "Đang xử lý — vui lòng liên hệ hotline nếu cần hỗ trợ";
}
