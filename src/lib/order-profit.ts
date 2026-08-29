import { computeOrderCharge, round2 } from "@/lib/pricing";

/**
 * Profit breakdown for a single order. The customer price is always the amount
 * stored on the order (`orders.price`, what the user actually paid). The
 * provider/cost price comes from the order's stored charge if one exists,
 * otherwise it is derived from the service's `provider_price` (cost per 1000
 * units) using the same `computeOrderCharge` math used everywhere else in the
 * panel. When no provider cost is available the result carries `null` values so
 * callers can display "N/A" instead of guessing.
 */

export interface OrderProfit {
  customerPrice: number;
  providerCost: number | null;
  profit: number | null;
  profitPercent: number | null;
}

export function computeOrderProfit(
  order: { price: number; quantity: number; charge?: number | null },
  service: { provider_price?: number | null } | null | undefined
): OrderProfit {
  const customerPrice = Number(order.price);
  if (!Number.isFinite(customerPrice) || customerPrice < 0) {
    return { customerPrice: 0, providerCost: null, profit: null, profitPercent: null };
  }

  const storedCharge =
    order.charge != null && Number.isFinite(Number(order.charge)) ? Number(order.charge) : null;
  const providerPrice =
    service?.provider_price != null && Number.isFinite(Number(service.provider_price))
      ? Number(service.provider_price)
      : null;

  let providerCost: number | null = null;
  if (storedCharge != null) {
    providerCost = round2(storedCharge);
  } else if (providerPrice != null) {
    providerCost = computeOrderCharge(providerPrice, order.quantity);
  }

  if (providerCost == null) {
    return { customerPrice, providerCost: null, profit: null, profitPercent: null };
  }

  const profit = round2(customerPrice - providerCost);
  const profitPercent = customerPrice > 0 ? round2((profit / customerPrice) * 100) : 0;
  return { customerPrice, providerCost, profit, profitPercent };
}
