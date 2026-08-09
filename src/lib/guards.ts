import type { Profile } from "@/lib/types/database";

export interface ActionResult<T = undefined> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

export function ok<T>(data?: T, message?: string): ActionResult<T> {
  return { success: true, data, message };
}

export function fail<T = never>(message: string): ActionResult<T> {
  return { success: false, error: message, message };
}

export async function requireUser(): Promise<
  | { user: Profile; error?: undefined }
  | { user: null; error: string }
> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return { user: null, error: "You must be logged in." };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (error || !profile) {
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
  if (result.user.role !== "admin") {
    return { user: null, error: "Forbidden: administrators only." };
  }
  return result;
}
