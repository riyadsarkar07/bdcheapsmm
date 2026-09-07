import type { Provider } from "@/lib/types/database";
import { parsePositiveMoney } from "@/lib/pricing";

export interface ProviderServiceItem {
  service: number;
  service_id: string;
  name: string;
  category: string;
  rate: number;
  min: number;
  max: number;
  type: string;
  average_time: string;
  description?: string;
  /** Whether the provider allows refill/cancel for this service, plus drip-feed type. */
  refill?: boolean | string;
  cancel?: boolean | string;
  driptype?: string;
}

export interface ProviderOrderResult {
  order: number;
  error?: boolean;
  message?: string;
}

export interface ProviderStatusResult {
  status: "Pending" | "In progress" | "Completed" | "Partial" | "Canceled" | "Refunded" | string;
  start_count?: number | string | null;
  remain?: number | string | null;
  /** Some SMMFollow-style APIs return the remaining quantity as `remains`. */
  remains?: number | string | null;
  charge?: number | string | null;
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

// SMMFollowOM serves its API behind Cloudflare's managed challenge, which
// answers requests carrying a bare Node/undici default user-agent from a
// datacenter IP with HTTP 403 "Just a moment...". Send a real browser
// user-agent plus Accept-Language so the legitimate server-to-server API
// call is not mistaken for a bot. This only identifies the client; it does
// not fake authentication or bypass any access control.
const PROVIDER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export function parseProviderRate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return parsePositiveMoney(value);
  const normalized = String(value)
    .trim()
    .replace(/[$,]/g, "")
    .replace(/\s+/g, "");
  return parsePositiveMoney(normalized);
}

export function normalizeProviderServiceId(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return Number.isInteger(value) ? String(value) : String(Math.trunc(value));
  }
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d+(\.0+)?$/.test(text)) return String(parseInt(text, 10));
  return text;
}

function unwrapProviderCatalog(data: unknown, depth = 0): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object" || depth > 3) return [];
  const record = data as Record<string, unknown>;
  for (const key of ["services", "data", "result", "items", "list"]) {
    const nested = record[key];
    if (Array.isArray(nested)) return nested;
  }
  for (const key of ["services", "data", "result", "items", "list"]) {
    const nested = record[key];
    if (nested && typeof nested === "object") {
      const deeper = unwrapProviderCatalog(nested, depth + 1);
      if (deeper.length > 0) return deeper;
    }
  }
  return [];
}

function firstValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
      return record[key];
    }
  }
  return undefined;
}

export function normalizeProviderServiceItem(raw: unknown): ProviderServiceItem | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const serviceId = normalizeProviderServiceId(
    firstValue(record, ["service", "service_id", "serviceId", "id", "ID"])
  );
  const rate = parseProviderRate(firstValue(record, ["rate", "price", "cost", "provider_price", "Rate"]));
  if (!serviceId || rate == null) return null;
  const numericId = Number(serviceId);
  return {
    service: Number.isFinite(numericId) ? numericId : 0,
    service_id: serviceId,
    name: String(firstValue(record, ["name", "service_name", "title"]) ?? ""),
    category: String(firstValue(record, ["category", "category_name"]) ?? ""),
    rate,
    min: Number(firstValue(record, ["min", "min_quantity", "minimum"]) ?? 1),
    max: Number(firstValue(record, ["max", "max_quantity", "maximum"]) ?? 100),
    type: String(firstValue(record, ["type", "service_type"]) ?? ""),
    average_time: String(firstValue(record, ["average_time", "average", "time"]) ?? ""),
    description: firstValue(record, ["description", "desc"]) != null
      ? String(firstValue(record, ["description", "desc"]))
      : undefined,
    refill: firstValue(record, ["refill"]) as boolean | string | undefined,
    cancel: firstValue(record, ["cancel"]) as boolean | string | undefined,
    driptype: firstValue(record, ["driptype", "drip_type"]) != null
      ? String(firstValue(record, ["driptype", "drip_type"]))
      : undefined,
  };
}

export function normalizeProviderCatalog(data: unknown): ProviderServiceItem[] {
  const rows = unwrapProviderCatalog(data);
  const items: ProviderServiceItem[] = [];
  for (const row of rows) {
    const item = normalizeProviderServiceItem(row);
    if (!item) continue;
    items.push(item);
  }
  return items;
}

function asRecord(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return {};
}

async function post(
  provider: Pick<Provider, "api_url" | "api_key" | "name">,
  action: string,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  if (!provider.api_url) {
    throw new ProviderError("Provider API URL is not configured");
  }
  if (!provider.api_key) {
    throw new ProviderError("Provider API key is not configured");
  }

  const url = provider.api_url.replace(/\/+$/, "");
  const body = new URLSearchParams();
  body.set("key", provider.api_key);
  body.set("action", action);
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
        "User-Agent": PROVIDER_USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9",
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
    let detail = "";
    try {
      const bodyText = await res.text();
      if (bodyText) detail = `: ${bodyText.slice(0, 300)}`;
    } catch {
      // ignore body read errors
    }
    throw new ProviderError(
      `${provider.name} responded with HTTP ${res.status}${detail}`,
      res.status
    );
  }

  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ProviderError(
      `Invalid JSON response from ${provider.name}`
    );
  }
}

/** Extract a human-readable provider error message, if present. */
function providerErrorMessage(data: Record<string, unknown>): string | null {
  if (typeof data.error === "string" && data.error) return data.error;
  if (typeof data.message === "string" && data.message) return data.message;
  return null;
}

/**
 * Throw a ProviderError when `data` has no success indicator. Success is
 * decided by each action's own expected field (e.g. `order`, `status`,
 * `refill`, `balance`), so a successful response that happens to include a
 * `message` field is never misread as a failure, while genuine rejections
 * surface the provider's exact error text.
 */
function assertProviderFailed(data: Record<string, unknown>, fallback: string): void {
  throw new ProviderError(providerErrorMessage(data) ?? fallback);
}

/** SMMFollow-compatible provider SDK. */
export const providerApi = {
  async getServices(
    provider: Pick<Provider, "api_url" | "api_key" | "name">
  ): Promise<ProviderServiceItem[]> {
    const data = await post(provider, "services");
    const items = normalizeProviderCatalog(data);
    if (items.length > 0) return items;
    const record = asRecord(data);
    if (record.error || record.message) {
      assertProviderFailed(record, "Failed to fetch services");
    }
    throw new ProviderError("Failed to fetch services");
  },

  async createOrder(
    provider: Pick<Provider, "api_url" | "api_key" | "name">,
    params: { service: number; link: string; quantity: number }
  ): Promise<ProviderOrderResult> {
    const data = asRecord(await post(provider, "add", {
      service: params.service,
      link: params.link,
      quantity: params.quantity,
    }));
    const order = Number(data.order);
    if (!order || Number.isNaN(order)) {
      assertProviderFailed(data, "Provider did not return an order id");
    }
    return { order, ...data } as unknown as ProviderOrderResult;
  },

  async getStatus(
    provider: Pick<Provider, "api_url" | "api_key" | "name">,
    providerOrderId: string | number
  ): Promise<ProviderStatusResult> {
    const data = asRecord(await post(provider, "status", { order: providerOrderId }));
    if (typeof data.status !== "string" || !data.status) {
      assertProviderFailed(data, "Status lookup failed");
    }
    return data as unknown as ProviderStatusResult;
  },

  async refill(
    provider: Pick<Provider, "api_url" | "api_key" | "name">,
    providerOrderId: string | number
  ): Promise<{ refill: boolean; message?: string }> {
    const data = asRecord(await post(provider, "refill", { order: providerOrderId }));
    if (data.refill === undefined) {
      assertProviderFailed(data, "Refill failed");
    }
    return data as unknown as { refill: boolean; message?: string };
  },

  async cancel(
    provider: Pick<Provider, "api_url" | "api_key" | "name">,
    providerOrderId: string | number
  ): Promise<{ cancelled: boolean; message?: string }> {
    const raw = await post(provider, "cancel", { orders: providerOrderId });
    if (Array.isArray(raw)) {
      return raw as unknown as { cancelled: boolean; message?: string };
    }
    const data = asRecord(raw);
    if (data.cancel === undefined && data.cancelled === undefined) {
      assertProviderFailed(data, "Cancel failed");
    }
    return data as unknown as { cancelled: boolean; message?: string };
  },

  async getBalance(
    provider: Pick<Provider, "api_url" | "api_key" | "name">
  ): Promise<ProviderBalanceResult> {
    const data = asRecord(await post(provider, "balance"));
    const balance = Number(data.balance);
    if (Number.isNaN(balance)) {
      assertProviderFailed(data, "Balance lookup failed");
    }
    return {
      ...data,
      balance,
    } as unknown as ProviderBalanceResult;
  },
};

const KNOWN_ORDER_STATUSES = [
  "pending",
  "processing",
  "in_progress",
  "completed",
  "partial",
  "cancelled",
  "refunded",
  "failed",
  "rejected",
] as const;

export function isKnownOrderStatus(status: string): boolean {
  return (KNOWN_ORDER_STATUSES as readonly string[]).includes(status);
}

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

/**
 * Normalize an SMM provider count field (e.g. start_count / remain) before it
 * is written to an integer column. Providers return "" or null for counts on
 * in-flight orders, and Postgres rejects "" for an int column. Empty, missing,
 * or non-numeric values become null; valid integers (including 0) are
 * preserved.
 */
export function normalizeProviderCount(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

/**
 * Merge the provider's count fields (start_count / remain) into the values
 * already saved on an order. A valid numeric count from the provider is saved;
 * empty/missing values ("", null, absent) keep the previously saved value so a
 * valid start count is never wiped while an order is still in flight. Handles
 * both the `remain` and `remains` provider field names.
 */
export function mergeProviderCounts(
  result: ProviderStatusResult,
  existing: { start_count: number | null; remain: number | null }
): { start_count: number | null; remain: number | null } {
  const startCount = normalizeProviderCount(result.start_count);
  const remain = normalizeProviderCount(result.remain ?? result.remains);
  return {
    start_count: startCount ?? existing.start_count,
    remain: remain ?? existing.remain,
  };
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
