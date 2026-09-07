/**
 * Shared pricing + platform mapping.
 *
 * SMMFollowOM (and this panel) quote prices per 1000 units: the provider's
 * `rate` and the retail `services.price` are both "price per 1k". The charge
 * for an order is therefore:
 *
 *   charge = round2(pricePer1000 * quantity / 1000)
 *
 * Money math uses integer cents so floating-point rounding cannot hide a loss.
 * Everything that prices an order (frontend display, server-side charge,
 * balance deduction and admin reporting) must go through this module so the
 * math stays identical everywhere.
 */

export function parseMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  return n;
}

export function parsePositiveMoney(value: unknown): number | null {
  const n = parseMoney(value);
  if (n == null || n <= 0) return null;
  return n;
}

const MINOR_SCALE = 10_000;

export function toMinor(value: number): number {
  return Math.round(Number((Number(value) * MINOR_SCALE).toFixed(8)));
}

export function minorToUsd(minor: number): number {
  return minor / MINOR_SCALE;
}

export function toCents(value: number): number {
  return Math.round(Number((Number(value) * 100).toFixed(8)));
}

export function centsToUsd(cents: number): number {
  return cents / 100;
}

export function round2(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return centsToUsd(toCents(n));
}

export function roundMoney(value: number, decimals = 4): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const factor = 10 ** decimals;
  return Math.round(Number((n * factor).toFixed(8))) / factor;
}

export type PriceRounding = "round2" | "round" | "ceil";

export function applyPriceRounding(value: number, rounding: PriceRounding = "round2"): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (rounding === "round") return Math.round(n);
  if (rounding === "ceil") return Math.ceil(n);
  return round2(n);
}

export function computeRetailPrice(
  providerPrice: number,
  marginPercent: number,
  rounding: PriceRounding = "round2"
): number {
  const cost = Number(providerPrice);
  const margin = Number(marginPercent);
  if (!Number.isFinite(cost) || cost <= 0) return 0;
  const pct = Number.isFinite(margin) ? margin : 0;
  return applyPriceRounding(cost * (1 + pct / 100), rounding);
}

export function computeOrderChargeCents(pricePer1000: number, quantity: number): number | null {
  const price = Number(pricePer1000);
  const qty = Number(quantity);
  if (!Number.isFinite(price) || !Number.isFinite(qty)) return null;
  if (price <= 0 || qty <= 0) return null;
  const cents = toCents((price * qty) / 1000);
  if (!Number.isFinite(cents) || cents <= 0) return null;
  return cents;
}

export function computeOrderCharge(pricePer1000: number, quantity: number): number {
  const cents = computeOrderChargeCents(pricePer1000, quantity);
  if (cents == null) return 0;
  return centsToUsd(cents);
}

export function computeProviderCost(pricePer1000: number, quantity: number): number | null {
  const price = Number(pricePer1000);
  const qty = Number(quantity);
  if (!Number.isFinite(price) || !Number.isFinite(qty)) return null;
  if (price <= 0 || qty <= 0) return null;
  const minor = toMinor((price * qty) / 1000);
  if (!Number.isFinite(minor) || minor <= 0) return null;
  return minorToUsd(minor);
}

export function formatChargeUsd(amount: number): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "$0.00";
  return (
    "$" +
    value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

export function insufficientBalanceMessage(required: number, current: number): string {
  return `Insufficient balance. Please add funds to place this order. Required: ${formatChargeUsd(required)}. Current balance: ${formatChargeUsd(current)}.`;
}

export function parseChargeError(message: string | null | undefined): {
  insufficient: boolean;
  current?: number;
  required?: number;
} {
  const text = message ?? "";
  const tagged = text.match(/INSUFFICIENT_BALANCE:(-?\d+(?:\.\d+)?):(-?\d+(?:\.\d+)?)/i);
  if (tagged) {
    return { insufficient: true, current: Number(tagged[1]), required: Number(tagged[2]) };
  }
  if (/insufficient/i.test(text)) return { insufficient: true };
  return { insufficient: false };
}

export function hasSufficientBalance(balance: number, charge: number): boolean {
  const wallet = round2(Number(balance));
  const cost = round2(Number(charge));
  if (!Number.isFinite(wallet) || !Number.isFinite(cost)) return false;
  if (wallet <= 0) return false;
  if (!(cost > 0)) return false;
  return wallet >= cost;
}

// ============================================================
// Platform detection (categories -> platform)
// ============================================================

export interface PlatformDef {
  slug: string;
  name: string;
  keywords: string[];
}

export const PLATFORMS: PlatformDef[] = [
  { slug: "instagram", name: "Instagram", keywords: ["instagram", "ig "] },
  { slug: "facebook", name: "Facebook", keywords: ["facebook", " fb "] },
  { slug: "youtube", name: "YouTube", keywords: ["youtube", "yt "] },
  { slug: "tiktok", name: "TikTok", keywords: ["tiktok", "tiktok "] },
  { slug: "twitter", name: "X / Twitter", keywords: ["twitter", "tweet", "retweet", " x "] },
  { slug: "telegram", name: "Telegram", keywords: ["telegram", "tg "] },
  { slug: "spotify", name: "Spotify", keywords: ["spotify"] },
  { slug: "soundcloud", name: "SoundCloud", keywords: ["soundcloud", "sound cloud"] },
  { slug: "threads", name: "Threads", keywords: ["threads"] },
  { slug: "discord", name: "Discord", keywords: ["discord"] },
  { slug: "whatsapp", name: "WhatsApp", keywords: ["whatsapp", "whats app"] },
  { slug: "linkedin", name: "LinkedIn", keywords: ["linkedin"] },
  { slug: "traffic", name: "Traffic", keywords: ["traffic", "website", "web site"] },
  { slug: "shopee", name: "Shopee", keywords: ["shopee", "lazada", "shopee"] },
];

export const OTHER_PLATFORM = "other";

export const PLATFORM_LABELS: Record<string, string> = Object.fromEntries(
  PLATFORMS.map((p) => [p.slug, p.name])
);

/**
 * Match a category name/slug to a platform slug. Unmatched categories belong
 * to the "other" platform so real services are never hidden.
 */
export function detectPlatform(name: string | null | undefined, slug?: string | null): string {
  const haystack = `${name ?? ""} ${slug ?? ""}`.toLowerCase();
  for (const platform of PLATFORMS) {
    for (const keyword of platform.keywords) {
      if (haystack.includes(keyword)) return platform.slug;
    }
  }
  return OTHER_PLATFORM;
}

/**
 * Example link used as a placeholder/hint for each platform. This is an input
 * hint only - it is never stored or sent to the provider.
 */
export function exampleLinkForPlatform(platform: string): string {
  switch (platform) {
    case "instagram":
      return "https://www.instagram.com/p/example";
    case "facebook":
      return "https://www.facebook.com/yourpage";
    case "youtube":
      return "https://www.youtube.com/watch?v=videoId";
    case "tiktok":
      return "https://www.tiktok.com/@username/video/123";
    case "twitter":
      return "https://x.com/username/status/123";
    case "telegram":
      return "https://t.me/yourchannel";
    case "spotify":
      return "https://open.spotify.com/track/spotifyId";
    case "soundcloud":
      return "https://soundcloud.com/username/track";
    case "threads":
      return "https://www.threads.net/@username";
    case "discord":
      return "https://discord.gg/invite";
    case "whatsapp":
      return "https://chat.whatsapp.com/invite";
    case "linkedin":
      return "https://www.linkedin.com/in/username";
    case "traffic":
      return "https://example.com";
    case "shopee":
      return "https://shopee.com.my/shop/yourshop";
    default:
      return "https://example.com/profile";
  }
}
