import { computeProviderCost, minorToUsd, parsePositiveMoney, round2, toMinor } from "@/lib/pricing";

/**
 * Profit breakdown for a single order. The customer price is always the amount
 * stored on the order (`orders.price`, what the user actually paid).
 *
 * Provider cost uses the order's recorded `charge` only when it is a real
 * positive amount. The column defaults to 0, so 0/null must be treated as
 * unknown — never as a $0.00 cost that would fake 100% profit.
 *
 * When no recorded cost exists, cost is derived from the service's
 * `provider_price` (per 1000). If that is also missing, profit is N/A.
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

  const recordedCost = parsePositiveMoney(order.charge);
  const providerPrice = parsePositiveMoney(service?.provider_price);

  let providerCost: number | null = null;
  if (recordedCost != null) {
    providerCost = recordedCost;
  } else if (providerPrice != null) {
    providerCost = computeProviderCost(providerPrice, order.quantity);
  }

  if (providerCost == null) {
    return { customerPrice, providerCost: null, profit: null, profitPercent: null };
  }

  const profitMinor = toMinor(customerPrice) - toMinor(providerCost);
  const profit = minorToUsd(profitMinor);
  const sellMinor = toMinor(customerPrice);
  const profitPercent = sellMinor > 0 ? round2((profitMinor / sellMinor) * 100) : null;
  return { customerPrice, providerCost, profit, profitPercent };
}
