import { cache } from "react";
import type { AuthUser } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types/database";

export interface ActionResult<T = undefined> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

interface SessionProfile {
  user: AuthUser | null;
  profile: Profile | null;
}

/**
 * Fetch the authenticated user and profile once per request. The dashboard
 * layout and every page both need the current user, so `cache()` collapses the
 * two Supabase round-trips into one during a single server render. Each
 * navigation / server action still gets a fresh result, so nothing goes stale.
 */
export const getSessionProfile = cache(
  async function getSessionProfile(): Promise<SessionProfile> {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return { user: null, profile: null };

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    return { user, profile: error || !profile ? null : (profile as Profile) };
  }
);

export function ok<T>(data?: T, message?: string): ActionResult<T> {
  return { success: true, data, message };
}

export function fail<T = never>(message: string): ActionResult<T> {
  return { success: false, error: message, message };
}

export function isAdminProfile(
  profile: Pick<Profile, "role" | "status">
): boolean {
  return profile.role === "admin" && profile.status === "active";
}

export async function requireUser(): Promise<
  | { user: Profile; error?: undefined }
  | { user: null; error: string }
> {
  const { user, profile } = await getSessionProfile();

  if (!user) {
    return { user: null, error: "You must be logged in." };
  }

  if (!profile) {
    return { user: null, error: "Profile not found." };
  }

  if (profile.status === "banned") {
    return { user: null, error: "Your account has been suspended." };
  }

  return { user: profile };
}

export async function requireAdmin(): Promise<
  | { user: Profile; error?: undefined }
  | { user: null; error: string }
> {
  const result = await requireUser();
  if (result.error || !result.user) return result;
  if (!isAdminProfile(result.user)) {
    return { user: null, error: "Forbidden: administrators only." };
  }
  return result;
}
