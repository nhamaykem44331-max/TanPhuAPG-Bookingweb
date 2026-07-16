import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = "v1";
const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60;

function tokenSecret(): string {
  const secret =
    process.env.BOOKING_PUBLIC_ACCESS_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error("BOOKING_PUBLIC_ACCESS_SECRET is not configured");
  }

  return secret;
}

function signature(bookingId: string, expiresAt: number): string {
  return createHmac("sha256", tokenSecret())
    .update(`${TOKEN_VERSION}:${bookingId}:${expiresAt}`)
    .digest("base64url");
}

export function createBookingPublicAccessToken(
  bookingId: string,
  options: { now?: Date; ttlSeconds?: number } = {},
): string {
  const now = options.now ?? new Date();
  const configuredTtl = Number(process.env.BOOKING_PUBLIC_ACCESS_TTL_SECONDS);
  const ttlSeconds = options.ttlSeconds ?? (
    Number.isFinite(configuredTtl) && configuredTtl > 0 ? configuredTtl : DEFAULT_TTL_SECONDS
  );
  const expiresAt = Math.floor(now.getTime() / 1000) + ttlSeconds;

  return `${expiresAt}.${signature(bookingId, expiresAt)}`;
}

export function verifyBookingPublicAccessToken(
  bookingId: string,
  token: string | null | undefined,
  now = new Date(),
): boolean {
  if (!token) return false;

  const [expiresText, receivedSignature, extra] = token.split(".");
  const expiresAt = Number(expiresText);
  if (extra || !receivedSignature || !Number.isSafeInteger(expiresAt)) return false;
  if (expiresAt <= Math.floor(now.getTime() / 1000)) return false;

  const expected = Buffer.from(signature(bookingId, expiresAt));
  const received = Buffer.from(receivedSignature);

  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function bookingPaymentPath(bookingId: string, token: string, later = false): string {
  const params = new URLSearchParams({ token });
  if (later) params.set("later", "1");
  return `/booking/payment/${encodeURIComponent(bookingId)}?${params.toString()}`;
}
