/**
 * SePay provider helper — Mức A: QR động + Webhook
 *
 * Luồng:
 *  1. Tạo PaymentIntent → gen URL `https://qr.sepay.vn/img?acc=...&bank=...&amount=...&des=APG<orderCode>`
 *  2. Khách CK đúng nội dung "APG<orderCode>" → SePay đọc biến động số dư → đẩy webhook
 *  3. Webhook handler match `content` với `providerOrderCode` đã tạo
 *
 * Tài liệu:
 *  - https://docs.sepay.vn/tao-qr-code-vietqr-dong.html
 *  - https://docs.sepay.vn/tich-hop-webhooks.html
 *  - https://docs.sepay.vn/lap-trinh-webhooks.html
 */

export interface SepayWebhookPayload {
  /** ID giao dịch trên SePay (unique key chống trùng) */
  id: number | string;
  gateway: string;
  /** Format "yyyy-mm-dd HH:MM:SS" theo doc */
  transactionDate: string;
  accountNumber: string;
  /** Tài khoản phụ (VA), null nếu không dùng */
  subAccount: string | null;
  /** "in" = tiền vào, "out" = tiền ra */
  transferType: "in" | "out" | string;
  /** Số tiền giao dịch — SePay gửi number, có thể là string */
  transferAmount: number | string;
  accumulated: number | string;
  code: string | null;
  /** Nội dung CK: thường chứa "APG<orderCode>" để match */
  content: string;
  referenceCode: string | null;
  description: string | null;
}

/**
 * IP whitelist SePay — cập nhật từ docs (2024-2025).
 * Nếu SePay đổi IP, chỉ cần override env SEPAY_WEBHOOK_IPS="ip1,ip2,..."
 */
export const SEPAY_DEFAULT_IPS = [
  "172.236.138.20",
  "172.233.83.68",
  "171.244.35.2",
  "151.158.108.68",
  "151.158.109.79",
  "103.255.238.139",
] as const;

/** Lấy danh sách IP whitelist (env override hoặc default) */
export function getSepayWhitelistIps(): string[] {
  const raw = process.env.SEPAY_WEBHOOK_IPS?.trim();

  if (!raw) {
    return [...SEPAY_DEFAULT_IPS];
  }

  return raw
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
}

/** Trích IP client thật từ headers (Vercel/Render forward) */
export function extractClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");

  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();

    if (first) {
      return first;
    }
  }

  return headers.get("x-real-ip") || headers.get("cf-connecting-ip") || null;
}

export function isSepayIpAllowed(ip: string | null): boolean {
  if (!ip) {
    return false;
  }

  // Cho phép tắt hoàn toàn IP check khi dev/test
  if (process.env.SEPAY_SKIP_IP_CHECK === "true") {
    return true;
  }

  return getSepayWhitelistIps().includes(ip);
}

/**
 * Verify Bearer token cho webhook (tự đặt khi cấu hình webhook trên SePay dashboard).
 * Trả `true` nếu match hoặc env không yêu cầu auth (dev mode).
 */
export function verifySepayAuth(headers: Headers): boolean {
  const expected = process.env.SEPAY_WEBHOOK_API_KEY?.trim();

  if (!expected) {
    // Không bắt buộc auth khi env chưa cấu hình — chỉ chấp nhận trong dev
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = headers.get("authorization")?.trim() || "";

  // SePay dashboard cho phép cấu hình "API Key" hoặc "Bearer" — chấp nhận cả 2
  const stripped =
    authHeader.replace(/^Bearer\s+/i, "").replace(/^Apikey\s+/i, "").trim();

  return stripped === expected;
}

export function assertSepayConfigured(): void {
  const acc = process.env.SEPAY_BANK_ACCOUNT?.trim();
  const bank = process.env.SEPAY_BANK_CODE?.trim();

  if (!acc || !bank) {
    throw new Error(
      "SePay chưa được cấu hình. Cần set SEPAY_BANK_ACCOUNT + SEPAY_BANK_CODE trong .env.",
    );
  }
}

export interface SepayQrInput {
  /** Nội dung CK: ví dụ "APG1234567" — giúp match webhook */
  transferContent: string;
  amount: number;
  /** Override account/bank nếu cần (ví dụ multi-account). Mặc định lấy từ env. */
  accountNumber?: string;
  bankCode?: string;
  /**
   * Template QR của SePay: "compact" | "compact2" | "qronly" | "print".
   * Mặc định "compact" — hiển thị logo + thông tin TK gọn gàng.
   */
  template?: "compact" | "compact2" | "qronly" | "print";
}

export interface SepayQrResult {
  qrUrl: string;
  accountNumber: string;
  bankCode: string;
  /** Tên hiển thị TK (lấy từ env) */
  accountName: string | null;
}

/** Build URL QR động qr.sepay.vn (image PNG) */
export function buildSepayQrUrl(input: SepayQrInput): SepayQrResult {
  assertSepayConfigured();

  const accountNumber = (input.accountNumber || process.env.SEPAY_BANK_ACCOUNT)!.trim();
  const bankCode = (input.bankCode || process.env.SEPAY_BANK_CODE)!.trim();
  const template = input.template || process.env.SEPAY_QR_TEMPLATE || "compact";
  const accountName = process.env.SEPAY_BANK_ACCOUNT_NAME?.trim() || null;

  const params = new URLSearchParams({
    acc: accountNumber,
    bank: bankCode,
    amount: String(input.amount),
    des: input.transferContent,
    template,
  });

  return {
    qrUrl: `https://qr.sepay.vn/img?${params.toString()}`,
    accountNumber,
    bankCode,
    accountName,
  };
}

/** Build dedupe key cho BankTransaction (tránh xử lý trùng webhook) */
export function buildSepayDedupeKey(payload: { id: number | string; transferAmount: number | string }): string {
  return `SEPAY:${String(payload.id)}:${String(payload.transferAmount)}`;
}

/** Parse số tiền webhook (có thể đến dạng string từ SePay) */
export function parseSepayAmount(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return Math.round(value);
  }

  const cleaned = value.replace(/[^\d.-]/g, "");
  const parsed = Number.parseFloat(cleaned);

  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

/** Parse "yyyy-mm-dd HH:MM:SS" → Date (timezone Asia/Ho_Chi_Minh) */
export function parseSepayTransactionDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}+07:00`;
  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Trích providerOrderCode từ content webhook.
 * Convention: nội dung CK có dạng "APG<orderCode>" hoặc chứa pattern "APG\w+".
 *
 * Ví dụ:
 *   "Thanh toan APG1737000000123 cho ve may bay" → "1737000000123"
 *   "APG1737000000123" → "1737000000123"
 */
export function extractOrderCodeFromContent(content: string | null | undefined): string | null {
  if (!content) {
    return null;
  }

  const match = content.match(/APG[\s_-]?(\d{6,})/i);

  return match?.[1] ?? null;
}
