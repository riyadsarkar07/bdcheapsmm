import { providerApi } from "@/lib/provider/smmfollow";
import {
  computeProviderCost,
  minorToUsd,
  parsePositiveMoney,
  toMinor,
} from "@/lib/pricing";
import type { Provider } from "@/lib/types/database";

export const SELLING_BELOW_COST_MESSAGE =
  "This service is temporarily unavailable because its current provider cost is higher than the selling price. Please try another service.";

export const PROVIDER_COST_UNKNOWN_MESSAGE =
  "This service is temporarily unavailable because its current provider cost could not be verified. Please try another service.";

export type PricingSafetyOk = {
  ok: true;
  providerCost: number;
  providerRate: number;
  source: "live" | "stored";
};

export type PricingSafetyFail = {
  ok: false;
  reason: "underpriced" | "unavailable";
  message: string;
};

export type PricingSafetyResult = PricingSafetyOk | PricingSafetyFail;

export function evaluatePricingSafety(
  sellingPrice: number,
  providerCost: number | null
): PricingSafetyResult {
  if (providerCost == null) {
    return { ok: false, reason: "unavailable", message: PROVIDER_COST_UNKNOWN_MESSAGE };
  }
  const sellMinor = toMinor(sellingPrice);
  const costMinor = toMinor(providerCost);
  if (!Number.isFinite(sellMinor) || !Number.isFinite(costMinor) || costMinor <= 0) {
    return { ok: false, reason: "unavailable", message: PROVIDER_COST_UNKNOWN_MESSAGE };
  }
  if (sellMinor < costMinor) {
    return { ok: false, reason: "underpriced", message: SELLING_BELOW_COST_MESSAGE };
  }
  return {
    ok: true,
    providerCost: minorToUsd(costMinor),
    providerRate: 0,
    source: "stored",
  };
}

const liveCatalogCache = new Map<string, { at: number; rates: Map<string, number> }>();
const LIVE_CATALOG_TTL_MS = 30_000;

function providerCacheKey(provider: Pick<Provider, "api_url" | "api_key" | "name">): string {
  return `${provider.api_url}::${provider.name}`;
}

async function loadLiveRates(
  provider: Pick<Provider, "api_url" | "api_key" | "name">
): Promise<Map<string, number> | null> {
  const key = providerCacheKey(provider);
  const cached = liveCatalogCache.get(key);
  if (cached && Date.now() - cached.at < LIVE_CATALOG_TTL_MS) return cached.rates;

  try {
    const items = await providerApi.getServices(provider);
    const rates = new Map<string, number>();
    for (const item of items) {
      const rate = parsePositiveMoney(item.rate);
      if (rate != null) rates.set(String(item.service), rate);
    }
    liveCatalogCache.set(key, { at: Date.now(), rates });
    return rates;
  } catch {
    return null;
  }
}

export async function resolveCurrentProviderRate(input: {
  provider: Pick<Provider, "api_url" | "api_key" | "name"> | null | undefined;
  providerServiceId: string | number | null | undefined;
  storedProviderPrice: unknown;
}): Promise<{ rate: number; source: "live" | "stored" } | null> {
  const stored = parsePositiveMoney(input.storedProviderPrice);

  if (input.provider && input.providerServiceId != null && String(input.providerServiceId).length > 0) {
    const rates = await loadLiveRates(input.provider);
    if (rates) {
      const live = rates.get(String(input.providerServiceId)) ?? null;
      if (live != null) return { rate: live, source: "live" };
    }
  }

  if (stored != null) return { rate: stored, source: "stored" };
  return null;
}

export async function assertOrderPricingSafety(input: {
  provider: Pick<Provider, "api_url" | "api_key" | "name"> | null | undefined;
  providerServiceId: string | number | null | undefined;
  storedProviderPrice: unknown;
  quantity: number;
  sellingPrice: number;
}): Promise<PricingSafetyResult> {
  const resolved = await resolveCurrentProviderRate({
    provider: input.provider,
    providerServiceId: input.providerServiceId,
    storedProviderPrice: input.storedProviderPrice,
  });

  if (!resolved) {
    return { ok: false, reason: "unavailable", message: PROVIDER_COST_UNKNOWN_MESSAGE };
  }

  const providerCost = computeProviderCost(resolved.rate, input.quantity);
  if (providerCost == null) {
    return { ok: false, reason: "unavailable", message: PROVIDER_COST_UNKNOWN_MESSAGE };
  }

  const checked = evaluatePricingSafety(input.sellingPrice, providerCost);
  if (!checked.ok) return checked;
  return {
    ok: true,
    providerCost,
    providerRate: resolved.rate,
    source: resolved.source,
  };
}
