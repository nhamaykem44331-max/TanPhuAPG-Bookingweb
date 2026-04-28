import {
  PayOS,
  type CreatePaymentLinkRequest,
  type CreatePaymentLinkResponse,
  type PaymentLink,
  type Webhook,
  type WebhookData,
} from "@payos/node";

export interface PayOSCreatePaymentLinkInput {
  orderCode: number;
  amount: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  buyerName?: string;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  expiredAt?: number;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} chưa được cấu hình.`);
  }

  return value;
}

export function assertPayOSConfigured(): void {
  requireEnv("PAYOS_CLIENT_ID");
  requireEnv("PAYOS_API_KEY");
  requireEnv("PAYOS_CHECKSUM_KEY");
}

export function createPayOSClient(): PayOS {
  return new PayOS({
    clientId: requireEnv("PAYOS_CLIENT_ID"),
    apiKey: requireEnv("PAYOS_API_KEY"),
    checksumKey: requireEnv("PAYOS_CHECKSUM_KEY"),
    logLevel: (process.env.PAYOS_LOG_LEVEL as "off" | "error" | "warn" | "info" | "debug" | undefined) ?? "warn",
  });
}

export function getPayOSReturnUrl(bookingId: string): string {
  const baseUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "") || "http://localhost:3000";
  return process.env.PAYOS_RETURN_URL?.replace("{bookingId}", bookingId)
    || `${baseUrl}/admin/bookings/${bookingId}?payment=success`;
}

export function getPayOSCancelUrl(bookingId: string): string {
  const baseUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "") || "http://localhost:3000";
  return process.env.PAYOS_CANCEL_URL?.replace("{bookingId}", bookingId)
    || `${baseUrl}/admin/bookings/${bookingId}?payment=cancelled`;
}

export async function createPayOSPaymentLink(input: PayOSCreatePaymentLinkInput): Promise<CreatePaymentLinkResponse> {
  const payload: CreatePaymentLinkRequest = {
    orderCode: input.orderCode,
    amount: input.amount,
    description: input.description,
    returnUrl: input.returnUrl,
    cancelUrl: input.cancelUrl,
    buyerName: input.buyerName,
    buyerEmail: input.buyerEmail ?? undefined,
    buyerPhone: input.buyerPhone ?? undefined,
    expiredAt: input.expiredAt,
    items: [
      {
        name: "Thanh toán vé máy bay Tân Phú APG",
        quantity: 1,
        price: input.amount,
      },
    ],
  };

  return createPayOSClient().paymentRequests.create(payload);
}

export async function getPayOSPaymentLink(orderCodeOrPaymentLinkId: number | string): Promise<PaymentLink> {
  return createPayOSClient().paymentRequests.get(orderCodeOrPaymentLinkId as never);
}

export async function cancelPayOSPaymentLink(orderCodeOrPaymentLinkId: number | string, reason: string): Promise<PaymentLink> {
  return createPayOSClient().paymentRequests.cancel(orderCodeOrPaymentLinkId as never, reason);
}

export async function verifyPayOSWebhook(webhook: Webhook): Promise<WebhookData> {
  return createPayOSClient().webhooks.verify(webhook);
}

export async function confirmPayOSWebhook(webhookUrl: string) {
  return createPayOSClient().webhooks.confirm(webhookUrl);
}
