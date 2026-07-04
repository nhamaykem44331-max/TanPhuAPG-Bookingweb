export interface BookingEmailContext {
  orderCode?: string | null;
  customerName: string;
  customerEmail: string | null;
  pnr: string;
  route: string;
  departAt: string;
  passengerCount: number;
  sellAmount: string;
  currency: string;
  ttlExpiresAt: string;
  paymentDue?: string;
  checkoutUrl?: string | null;
  transferContent?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  bankName?: string | null;
  qrImageUrl?: string | null;
  lookupUrl?: string | null;
}
