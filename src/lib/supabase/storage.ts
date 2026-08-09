import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

const BUCKET = "payment-proofs";
const SIGNED_URL_EXPIRY = 7 * 24 * 60 * 60; // 7 days

/**
 * Resolve a stored screenshot path (e.g. "payments/...") into a signed URL so
 * it can be rendered. The `payment-proofs` bucket is private, so plain public
 * URLs are never used. Returns the original value for legacy absolute URLs.
 */
export async function resolveScreenshotUrl(
  supabase: SupabaseClient<Database>,
  value: string | null
): Promise<string | null> {
  if (!value) return null;
  if (/^https?:\/\//.test(value)) return value;
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(value, SIGNED_URL_EXPIRY);
  return data?.signedUrl ?? null;
}

export async function resolveScreenshotUrls<T extends { screenshot_url: string | null }>(
  supabase: SupabaseClient<Database>,
  rows: T[]
): Promise<T[]> {
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      screenshot_url: await resolveScreenshotUrl(supabase, row.screenshot_url),
    }))
  );
}
