"use server";

import { advisorQuerySchema } from "@/lib/validations";
import { fail, ok, requireUser, type ActionResult } from "@/lib/guards";
import { PLATFORM_LABELS } from "@/lib/pricing";

export type AdvisorRecommendation = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  min_quantity: number;
  max_quantity: number;
  average_time: string | null;
  type: string | null;
  is_featured: boolean;
  category_name: string | null;
  score: number;
  reason: string;
};

export type AdvisorInterpret = {
  platform: string | null;
  platformLabel: string | null;
  goalType: string | null;
  goalLabel: string | null;
};

export type AdvisorRecommendPayload = {
  exact: AdvisorRecommendation[];
  related: AdvisorRecommendation[];
  interpretation: AdvisorInterpret;
};

type GoalTypeDef = {
  slug: string;
  label: string;
  patterns: RegExp[];
};

const PLATFORM_WORDS: { slug: string; words: string[] }[] = [
  { slug: "instagram", words: ["instagram", "insta"] },
  { slug: "facebook", words: ["facebook"] },
  { slug: "youtube", words: ["youtube"] },
  { slug: "tiktok", words: ["tiktok"] },
  { slug: "twitter", words: ["twitter", "tweet", "tweets", "retweet", "retweets"] },
  { slug: "telegram", words: ["telegram"] },
  { slug: "spotify", words: ["spotify"] },
  { slug: "soundcloud", words: ["soundcloud"] },
  { slug: "threads", words: ["threads"] },
  { slug: "discord", words: ["discord"] },
  { slug: "whatsapp", words: ["whatsapp"] },
  { slug: "linkedin", words: ["linkedin"] },
  { slug: "traffic", words: ["traffic"] },
  { slug: "shopee", words: ["shopee", "lazada"] },
];

const PLATFORM_SHORT_TOKENS: Record<string, string> = {
  ig: "instagram",
  yt: "youtube",
  fb: "facebook",
  tt: "tiktok",
  tg: "telegram",
};

const GOAL_TYPES: GoalTypeDef[] = [
  {
    slug: "watch_hours",
    label: "Watch Hours",
    patterns: [/\bwatch\s*hours?\b/, /\bwatch\s*time\b/, /\bwatchtime\b/, /\b4k\s*hours?\b/],
  },
  {
    slug: "subscribers",
    label: "Subscribers",
    patterns: [/\bsubscribers?\b/, /\bsubs\b/],
  },
  {
    slug: "followers",
    label: "Followers",
    patterns: [/\bfollowers?\b/, /\bfollowing\b/],
  },
  {
    slug: "comments",
    label: "Comments",
    patterns: [/\bcomments?\b/],
  },
  {
    slug: "likes",
    label: "Likes",
    patterns: [
      /\blikes\b/,
      /\breactions?\b/,
      /\b(?:youtube|instagram|insta|tiktok|facebook|twitter|telegram|spotify|ig|yt|fb|tt)\s+like\b/,
    ],
  },
  {
    slug: "shares",
    label: "Shares",
    patterns: [/\bshares?\b/, /\breposts?\b/, /\bretweets?\b/],
  },
  {
    slug: "members",
    label: "Members",
    patterns: [/\bmembers?\b/],
  },
  {
    slug: "mentions",
    label: "Mentions",
    patterns: [/\bmentions?\b/],
  },
  {
    slug: "reviews",
    label: "Reviews",
    patterns: [/\breviews?\b/],
  },
  {
    slug: "views",
    label: "Views",
    patterns: [/\bviews?\b/, /\bplays\b/, /\bstreams?\b/],
  },
];

const SERVICE_GOAL_PATTERNS: Record<string, RegExp[]> = {
  watch_hours: [/\bwatch\s*hours?\b/, /\bwatch\s*time\b/, /\bwatchtime\b/, /\b4k\s*hours?\b/],
  subscribers: [/\bsubscribers?\b/, /\bsubs\b/],
  followers: [/\bfollowers?\b/, /\bfollowing\b/],
  comments: [/\bcomments?\b/],
  likes: [/\blikes?\b/, /\breactions?\b/],
  shares: [/\bshares?\b/, /\breposts?\b/, /\bretweets?\b/],
  members: [/\bmembers?\b/],
  mentions: [/\bmentions?\b/],
  reviews: [/\breviews?\b/],
  views: [/\bviews?\b/, /\bplays?\b/, /\bstreams?\b/],
};

const STOP = new Set([
  "the", "and", "for", "with", "want", "need", "please", "some", "more", "my",
  "to", "of", "in", "on", "a", "an", "get", "buy", "order", "help", "me", "i",
  "am", "looking", "trying", "grow", "growth", "page", "shop", "new", "video",
  "account", "profile", "channel", "post", "real", "cheap", "best", "fast",
  "would", "could", "should",
]);

type CatalogService = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  min_quantity: number;
  max_quantity: number;
  average_time: string | null;
  type: string | null;
  is_featured: boolean;
  categories: unknown;
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeText(text).split(" ").filter((t) => t.length >= 2);
}

function categoryFields(categories: unknown): { name: string | null; slug: string | null } {
  const row = Array.isArray(categories) ? categories[0] : categories;
  if (!row || typeof row !== "object") return { name: null, slug: null };
  const rec = row as { name?: string | null; slug?: string | null };
  return { name: rec.name ?? null, slug: rec.slug ?? null };
}

function matchPlatform(text: string): string | null {
  const haystack = normalizeText(text);
  if (!haystack) return null;
  for (const platform of PLATFORM_WORDS) {
    for (const word of platform.words) {
      if (new RegExp(`\\b${word}\\b`).test(haystack)) return platform.slug;
    }
  }
  for (const token of haystack.split(" ")) {
    const mapped = PLATFORM_SHORT_TOKENS[token];
    if (mapped) return mapped;
  }
  return null;
}

function detectQueryPlatform(goal: string): string | null {
  return matchPlatform(goal);
}

function detectGoalType(text: string): GoalTypeDef | null {
  const haystack = normalizeText(text);
  for (const goal of GOAL_TYPES) {
    if (goal.patterns.some((pattern) => pattern.test(haystack))) return goal;
  }
  return null;
}

function serviceHasGoalType(haystack: string, goalSlug: string): boolean {
  const patterns = SERVICE_GOAL_PATTERNS[goalSlug];
  if (!patterns) return false;
  return patterns.some((pattern) => pattern.test(haystack));
}

function detectServicePlatform(name: string, categoryName: string | null, categorySlug: string | null): string | null {
  return matchPlatform(name) ?? matchPlatform(`${categoryName ?? ""} ${categorySlug ?? ""}`);
}

function platformLabel(slug: string | null): string | null {
  if (!slug) return null;
  return PLATFORM_LABELS[slug] ?? slug;
}

function describeNeed(interpretation: AdvisorInterpret): string {
  return [interpretation.platformLabel, interpretation.goalLabel].filter(Boolean).join(" ");
}

function toRecommendation(
  service: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    min_quantity: number;
    max_quantity: number;
    average_time: string | null;
    type: string | null;
    is_featured: boolean;
    category_name: string | null;
  },
  score: number,
  reason: string
): AdvisorRecommendation {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    price: service.price,
    min_quantity: service.min_quantity,
    max_quantity: service.max_quantity,
    average_time: service.average_time,
    type: service.type,
    is_featured: service.is_featured,
    category_name: service.category_name,
    score,
    reason,
  };
}

async function fetchActiveServices(): Promise<{ data: CatalogService[]; error: string | null }> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const pageSize = 1000;
  const all: CatalogService[] = [];
  let from = 0;

  while (from < 20000) {
    const { data, error } = await supabase
      .from("services")
      .select("id, name, description, price, min_quantity, max_quantity, average_time, type, is_featured, is_active, categories(name, slug, icon)")
      .eq("is_active", true)
      .range(from, from + pageSize - 1);

    if (error) return { data: [], error: error.message };
    const batch = (data ?? []) as CatalogService[];
    all.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return { data: all, error: null };
}

export async function recommendServicesAction(
  input: unknown
): Promise<ActionResult<AdvisorRecommendPayload>> {
  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");

  const parsed = advisorQuerySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid request");

  const goal = parsed.data.goal.trim();
  const tokens = tokenize(goal).filter((t) => !STOP.has(t));
  const platform = detectQueryPlatform(goal);
  const goalType = detectGoalType(goal);
  const interpretation: AdvisorInterpret = {
    platform,
    platformLabel: platformLabel(platform),
    goalType: goalType?.slug ?? null,
    goalLabel: goalType?.label ?? null,
  };

  const { data: services, error: queryError } = await fetchActiveServices();
  if (queryError) return fail(queryError);

  const need = describeNeed(interpretation);
  const exact: AdvisorRecommendation[] = [];
  const related: AdvisorRecommendation[] = [];
  const requireBoth = Boolean(platform && goalType);

  for (const service of services) {
    const { name: categoryName, slug: categorySlug } = categoryFields(service.categories);
    const servicePlatform = detectServicePlatform(service.name, categoryName, categorySlug);
    const haystack = normalizeText(
      `${service.name} ${service.description ?? ""} ${service.type ?? ""} ${categoryName ?? ""} ${categorySlug ?? ""}`
    );

    const platformOk = !platform || servicePlatform === platform;
    const typeOk = !goalType || serviceHasGoalType(haystack, goalType.slug);

    let score = 0;
    for (const token of tokens) {
      if (haystack.includes(token)) score += token.length > 4 ? 3 : 2;
    }
    if (platform && servicePlatform === platform) score += 8;
    if (goalType && serviceHasGoalType(haystack, goalType.slug)) score += 8;
    if (service.is_featured) score += 1;

    const recBase = {
      id: service.id,
      name: service.name,
      description: service.description,
      price: service.price,
      min_quantity: service.min_quantity,
      max_quantity: service.max_quantity,
      average_time: service.average_time,
      type: service.type,
      is_featured: service.is_featured,
      category_name: categoryName,
    };

    if (requireBoth) {
      if (platformOk && typeOk) {
        exact.push(toRecommendation(recBase, score, `Exact match for ${need}`));
      } else if (platformOk) {
        related.push(
          toRecommendation(
            recBase,
            score,
            interpretation.platformLabel
              ? `Same platform: ${interpretation.platformLabel}`
              : "Same platform"
          )
        );
      }
      continue;
    }

    const tokenHit = tokens.some((token) => haystack.includes(token));
    const isMatch = platformOk && typeOk && (Boolean(platform) || Boolean(goalType) || tokenHit);
    if (isMatch && score > 0) {
      exact.push(
        toRecommendation(
          recBase,
          score,
          need ? `Matches ${need}` : `Matches ${tokens.slice(0, 4).join(", ")}`
        )
      );
    }
  }

  exact.sort((a, b) => b.score - a.score || a.price - b.price);
  related.sort((a, b) => b.score - a.score || a.price - b.price);

  const payload: AdvisorRecommendPayload = {
    exact: exact.slice(0, 8),
    related: exact.length === 0 ? related.slice(0, 6) : [],
    interpretation,
  };

  if (payload.exact.length === 0) {
    const label = need || "your request";
    return ok(
      payload,
      payload.related.length > 0
        ? `No exact match found for ${label}. Showing closely related services.`
        : `No exact match found for ${label}.`
    );
  }

  return ok(payload);
}
