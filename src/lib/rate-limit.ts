type RateLimitResponse = { success: boolean; limit: number; remaining: number };

interface Store {
  get(key: string): Promise<number | null>;
  set(key: string, value: number, ttlSeconds: number): Promise<void>;
}

class MemoryStore implements Store {
  private map = new Map<string, { count: number; expiresAt: number }>();

  async get(key: string): Promise<number | null> {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return entry.count;
  }

  async set(key: string, value: number, ttlSeconds: number): Promise<void> {
    this.map.set(key, { count: value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

class UpstashStore implements Store {
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  private async call(...args: unknown[]): Promise<unknown> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`Upstash error ${res.status}`);
    return res.json();
  }

  async get(key: string): Promise<number | null> {
    const value = await this.call("GET", key);
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  async set(key: string, value: number, ttlSeconds: number): Promise<void> {
    await this.call("SET", key, value, "EX", ttlSeconds);
  }
}

function getStore(): Store {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return new UpstashStore(url, token);
  }
  return new MemoryStore();
}

let store: Store | null = null;

/**
 * Sliding-window rate limiter.
 * @param identifier Unique key (e.g. "ip:1.2.3.4" or "user:<id>:action").
 * @param limit Max requests per window.
 * @param windowSeconds Window size in seconds.
 */
export async function rateLimit(
  identifier: string,
  limit = 10,
  windowSeconds = 60
): Promise<RateLimitResponse> {
  if (!store) store = getStore();
  const now = Math.floor(Date.now() / 1000);
  const current = await store.get(identifier);

  if (current === null) {
    await store.set(identifier, 1, windowSeconds);
    return { success: true, limit, remaining: limit - 1 };
  }

  if (current >= limit) {
    return { success: false, limit, remaining: 0 };
  }

  await store.set(identifier, current + 1, windowSeconds);
  return { success: true, limit, remaining: limit - current - 1 };
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
