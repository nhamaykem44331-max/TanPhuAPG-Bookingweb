import type { HoldBookingResponse } from "@/lib/types";

// Lệch nhỏ (làm tròn, phí xuất vé trẻ em) thì bỏ qua; chỉ điều chỉnh khi lệch đáng kể.
export const PRICE_RECONCILE_TOLERANCE = 10_000;

/**
 * Giá VỐN thật do Nam Thành trả về sau khi giữ chỗ = tổng totalAmount các PNR.
 * ĐÃ GỒM HÀNH LÝ (byPnr đọc từ totalPrice/data.total của ticket-info = tổng bill PNR gồm SSR).
 * Chỉ tin khi đủ dữ liệu mọi PNR (không thiếu, không âm) để tránh chốt nhầm.
 */
export function realCostFromHold(holdResult: HoldBookingResponse): number | null {
  const heldPnrCount = (holdResult.pnrs || []).filter(
    (pnr) => pnr.pnr && !String(pnr.pnr).toUpperCase().startsWith("PENDING"),
  ).length;
  const byPnr = holdResult.pricing?.byPnr;

  if (Array.isArray(byPnr) && byPnr.length > 0 && (heldPnrCount === 0 || byPnr.length >= heldPnrCount)) {
    let sum = 0;
    for (const item of byPnr) {
      const amount = Number(item?.totalAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return null; // thiếu giá 1 PNR → không tin tổng, để quote per-pax tự lo
      }
      sum += amount;
    }
    return Math.round(sum);
  }

  const total = Number(holdResult.pricing?.totalAmount);
  return Number.isFinite(total) && total > 0 ? Math.round(total) : null;
}

export interface ReconcileResult {
  netAmount: number;
  saleAmount: number;
  profit: number;
  reconcile: { quoteNet: number; realCost: number; diff: number } | null;
}

/**
 * Chốt số tiền cuối cho đơn giữ chỗ.
 * - quoteNet/quoteSell: flight-only (chưa hành lý), đã tính theo SỐ KHÁCH.
 * - quoteMargin: markup + phí dịch vụ (đã theo số khách).
 * - baggageTotal: hành lý pass-through (không markup).
 * - realCost: tổng vốn thật Nam Thành (ĐÃ gồm hành lý) hoặc null nếu chưa có.
 *
 * Không reconcile → net/sale = quote (+ hành lý). Reconcile (lệch > tolerance) → lấy realCost làm net,
 * sale = realCost + margin. KHÔNG cộng thêm baggageTotal ở nhánh reconcile vì realCost đã gồm hành lý.
 * Vì margin >= 0 nên sale luôn >= vốn (không bao giờ bán dưới vốn).
 */
export function reconcileHoldAmounts(args: {
  quoteNet: number;
  quoteSell: number;
  quoteMargin: number;
  baggageTotal: number;
  realCost: number | null;
  tolerance?: number;
}): ReconcileResult {
  const tolerance = args.tolerance ?? PRICE_RECONCILE_TOLERANCE;
  const quoteNetWithBaggage = args.quoteNet + args.baggageTotal;
  const quoteSellWithBaggage = args.quoteSell + args.baggageTotal;

  let netAmount = quoteNetWithBaggage;
  let saleAmount = quoteSellWithBaggage;
  let reconcile: ReconcileResult["reconcile"] = null;

  if (args.realCost != null && Math.abs(args.realCost - quoteNetWithBaggage) > tolerance) {
    reconcile = { quoteNet: quoteNetWithBaggage, realCost: args.realCost, diff: args.realCost - quoteNetWithBaggage };
    netAmount = args.realCost;
    saleAmount = args.realCost + args.quoteMargin;
  }

  return { netAmount, saleAmount, profit: saleAmount - netAmount, reconcile };
}
