/**
 * Shared pricing + platform mapping.
 *
 * SMMFollowOM (and this panel) quote prices per 1000 units: the provider's
 * `rate` and the retail `services.price` are both "price per 1k". The charge
 * for an order is therefore:
 *
 *   charge = round2(pricePer1000 * quantity / 1000)
 *
 * Everything that prices an order (frontend display, server-side charge,
 * balance deduction and admin reporting) must go through this module so the
 * math stays identical everywhere.
 */

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeOrderCharge(pricePer1000: number, quantity: number): number {
  const price = Number(pricePer1000);
  const qty = Number(quantity);
  if (!Number.isFinite(price) || !Number.isFinite(qty)) return 0;
  if (price <= 0 || qty <= 0) return 0;
  return round2((price * qty) / 1000);
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
