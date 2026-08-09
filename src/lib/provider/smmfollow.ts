import type { Provider } from "@/lib/types/database";

export interface ProviderServiceItem {
  service: number;
  name: string;
  category: string;
  rate: number;
  min: number;
  max: number;
  type: string;
  average_time: string;
  description?: string;
}

export interface ProviderOrderResult {
  order: number;
  error?: boolean;
  message?: string;
}

export interface ProviderStatusResult {
  status: "Pending" | "In progress" | "Completed" | "Partial" | "Canceled" | "Refunded" | string;
  start_count?: number;
  remain?: number;
  charge?: number;
  error?: boolean;
  message?: string;
  refill?: { status: string };
}

export interface ProviderBalanceResult {
  balance: number;
  currency?: string;
  error?: boolean;
  message?: string;
}

export class ProviderError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}

const TIMEOUT_MS = 20_000;

async function post(
  provider: Pick<Provider, "api_url" | "api_key" | "name">,
  action: string,
  params: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  if (!provider.api_url) {
    throw new ProviderError("Provider API URL is not configured");
  }
  if (!provider.api_key) {
    throw new ProviderError("Provider API key is not configured");
  }

  const url = `${provider.api_url.replace(/\/+$/, "")}/${action}`;
  const body = new URLSearchParams();
  body.set("key", provider.api_key);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      body.set(key, String(value));
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new ProviderError(
      `Network error contacting ${provider.name}: ${(err as Error).message}`
    );
  }

  if (!res.ok) {
    throw new ProviderError(
      `${provider.name} responded with HTTP ${res.status}`,
      res.status
    );
  }

  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ProviderError(
      `Invalid JSON response from ${provider.name}`
    );
  }

  return data;
}

/** SMMFollow-compatible provider SDK. */
export const providerApi = {
  async getServices(
    provider: Pick<Provider, "api_url" | "api_key" | "name">
  ): Promise<ProviderServiceItem[]> {
    const data = await post(provider, "services");
    if (data.error) {
      throw new ProviderError(String(data.message ?? "Failed to fetch services"));
    }
    return (Array.isArray(data) ? data : data.services ?? []) as ProviderServiceItem[];
  },

  async createOrder(
    provider: Pick<Provider, "api_url" | "api_key" | "name">,
    params: { service: number; link: string; quantity: number }
  ): Promise<ProviderOrderResult> {
    const data = await post(provider, "order", {
      service: params.service,
      link: params.link,
      quantity: params.quantity,
    });
    if (data.error) {
      throw new ProviderError(String(data.message ?? "Order failed"));
    }
    const order = Number(data.order);
    if (!order || Number.isNaN(order)) {
      throw new ProviderError("Provider did not return an order id");
    }
    return { order, ...data } as unknown as ProviderOrderResult;
  },

  async getStatus(
    provider: Pick<Provider, "api_url" | "api_key" | "name">,
    providerOrderId: string | number
  ): Promise<ProviderStatusResult> {
    const data = await post(provider, "status", { order: providerOrderId });
    if (data.error) {
      throw new ProviderError(String(data.message ?? "Status lookup failed"));
    }
    return data as unknown as ProviderStatusResult;
  },

  async refill(
    provider: Pick<Provider, "api_url" | "api_key" | "name">,
    providerOrderId: string | number
  ): Promise<{ refill: boolean; message?: string }> {
    const data = await post(provider, "refill", { order: providerOrderId });
    if (data.error) {
      throw new ProviderError(String(data.message ?? "Refill failed"));
    }
    return data as unknown as { refill: boolean; message?: string };
  },

  async cancel(
    provider: Pick<Provider, "api_url" | "api_key" | "name">,
    providerOrderId: string | number
  ): Promise<{ cancelled: boolean; message?: string }> {
    const data = await post(provider, "cancel", { order: providerOrderId });
    if (data.error) {
      throw new ProviderError(String(data.message ?? "Cancel failed"));
    }
    return data as unknown as { cancelled: boolean; message?: string };
  },

  async getBalance(
    provider: Pick<Provider, "api_url" | "api_key" | "name">
  ): Promise<ProviderBalanceResult> {
    const data = await post(provider, "balance");
    if (data.error) {
      throw new ProviderError(String(data.message ?? "Balance lookup failed"));
    }
    return data as unknown as ProviderBalanceResult;
  },
};

export function normalizeProviderStatus(status: string): string {
  const lower = status.toLowerCase();
  if (lower.includes("complete")) return "completed";
  if (lower.includes("progress")) return "in_progress";
  if (lower.includes("pending")) return "pending";
  if (lower.includes("partial")) return "partial";
  if (lower.includes("cancel")) return "cancelled";
  if (lower.includes("refund")) return "refunded";
  if (lower.includes("fail")) return "failed";
  if (lower.includes("processing")) return "processing";
  if (lower.includes("reject")) return "rejected";
  return status;
}

export function parseServiceType(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes("comment")) return "comment";
  if (lower.includes("subscriber") || lower.includes("members")) return "subscribers";
  if (lower.includes("views") || lower.includes("plays") || lower.includes("streams")) return "views";
  if (lower.includes("like") || lower.includes("reaction")) return "likes";
  if (lower.includes("followers")) return "followers";
  if (lower.includes("repost") || lower.includes("retweet") || lower.includes("shares")) return "shares";
  if (lower.includes("mention")) return "mentions";
  if (lower.includes("review")) return "reviews";
  if (lower.includes("package") || lower.includes("mix") || lower.includes("combined")) return "mix";
  return "other";
}
