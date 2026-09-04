import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "payment-proofs";
const SIGNED_URL_EXPIRY = 60 * 60;

export function extractPaymentProofPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const pathname = decodeURIComponent(url.pathname);
      const needle = `/${BUCKET}/`;
      const idx = pathname.indexOf(needle);
      if (idx !== -1) {
        return pathname.slice(idx + needle.length).replace(/^\/+/, "");
      }
    } catch {
      return null;
    }
    return null;
  }

  let path = trimmed.replace(/^\/+/, "");
  if (path.startsWith(`${BUCKET}/`)) {
    path = path.slice(BUCKET.length + 1);
  }
  return path || null;
}

export async function signPaymentProofPath(path: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_EXPIRY);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

export async function resolveScreenshotUrl(
  _supabase: SupabaseClient<Database>,
  value: string | null
): Promise<string | null> {
  if (!value) return null;
  const path = extractPaymentProofPath(value);
  if (!path) {
    if (/^https?:\/\//i.test(value)) return value;
    return null;
  }
  return (await signPaymentProofPath(path)) ?? null;
}

export async function resolveScreenshotUrls<T extends { id: string; screenshot_url: string | null }>(
  supabase: SupabaseClient<Database>,
  rows: T[]
): Promise<T[]> {
  return Promise.all(
    rows.map(async (row) => {
      if (!row.screenshot_url) return row;
      const signed = await resolveScreenshotUrl(supabase, row.screenshot_url);
      return {
        ...row,
        screenshot_url: signed ?? `/api/payments/${row.id}/screenshot`,
      };
    })
  );
}
