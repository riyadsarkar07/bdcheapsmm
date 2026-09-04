"use server";

import { advisorQuerySchema } from "@/lib/validations";
import { fail, ok, requireUser, type ActionResult } from "@/lib/guards";
import { detectPlatform } from "@/lib/pricing";

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

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

const STOP = new Set([
  "the", "and", "for", "with", "want", "need", "please", "some", "more", "my",
  "to", "of", "in", "on", "a", "an", "get", "buy", "order", "help", "me", "i",
]);

export async function recommendServicesAction(
  input: unknown
): Promise<ActionResult<AdvisorRecommendation[]>> {
  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");

  const parsed = advisorQuerySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid request");

  const goal = parsed.data.goal.trim();
  const tokens = tokenize(goal).filter((t) => !STOP.has(t));
  const platform = detectPlatform(goal, goal);

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: services, error: queryError } = await supabase
    .from("services")
    .select("id, name, description, price, min_quantity, max_quantity, average_time, type, is_featured, is_active, categories(name, slug, icon)")
    .eq("is_active", true)
    .limit(400);

  if (queryError) return fail(queryError.message);

  const scored: AdvisorRecommendation[] = (services ?? []).map((service) => {
    const haystack = `${service.name} ${service.description ?? ""} ${service.type ?? ""} ${service.categories?.name ?? ""}`.toLowerCase();
    let score = 0;
    const matched: string[] = [];

    for (const token of tokens) {
      if (haystack.includes(token)) {
        score += token.length > 4 ? 3 : 2;
        matched.push(token);
      }
    }

    const servicePlatform = detectPlatform(service.categories?.name, service.categories?.slug);
    if (platform !== "other" && servicePlatform === platform) {
      score += 6;
      matched.push(platform);
    }
    if (service.is_featured) score += 1;

    const unique = Array.from(new Set(matched)).slice(0, 4);
    const reason =
      unique.length > 0
        ? `Matches ${unique.join(", ")}`
        : "Related active service from the catalog";

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
      category_name: service.categories?.name ?? null,
      score,
      reason,
    };
  });

  const ranked = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.price - b.price)
    .slice(0, 8);

  if (ranked.length === 0) {
    const featured = scored
      .filter((s) => s.is_featured)
      .sort((a, b) => a.price - b.price)
      .slice(0, 6)
      .map((s) => ({ ...s, reason: "Popular active service" }));
    if (featured.length > 0) return ok(featured);
    return ok(
      scored.sort((a, b) => a.price - b.price).slice(0, 6).map((s) => ({
        ...s,
        reason: "Active catalog service",
      }))
    );
  }

  return ok(ranked);
}
