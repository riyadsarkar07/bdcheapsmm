"use server";

import { headers } from "next/headers";
import { fail, ok, requireUser, type ActionResult } from "@/lib/guards";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getSessionIdFromAccessToken } from "@/lib/session-security";
import { writeLog } from "@/lib/audit";

async function getCurrentSessionId(): Promise<string | null> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return getSessionIdFromAccessToken(session?.access_token);
}

export async function revokeUserSessionAction(sessionId: string): Promise<ActionResult<{ revoked: boolean }>> {
  const headerStore = await headers();
  const ip = getClientIp(headerStore);

  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");
  if (!sessionId || sessionId.length > 64) return fail("Invalid session.");

  const limited = await rateLimit(`revoke-session:${user.id}`, 20, 300);
  if (!limited.success) return fail("Too many requests. Please try again later.");

  const currentSessionId = await getCurrentSessionId();
  if (currentSessionId && sessionId === currentSessionId) {
    return fail("This is your current session. Use Sign out instead.");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error: rpcError } = await supabase.rpc("revoke_user_session", {
    p_session_id: sessionId,
  });
  if (rpcError) return fail(rpcError.message);

  await writeLog({
    userId: user.id,
    action: "logout",
    entityType: "profiles",
    entityId: user.id,
    description: "Signed out a session remotely",
    ip,
    userAgent: headerStore.get("user-agent"),
    meta: { session_id: sessionId },
  });

  return ok({ revoked: Boolean(data) }, data ? "Session signed out." : "Session not found or already signed out.");
}

export async function revokeOtherSessionsAction(): Promise<ActionResult<{ count: number }>> {
  const headerStore = await headers();
  const ip = getClientIp(headerStore);

  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");

  const limited = await rateLimit(`revoke-others:${user.id}`, 10, 300);
  if (!limited.success) return fail("Too many requests. Please try again later.");

  const currentSessionId = await getCurrentSessionId();
  if (!currentSessionId) return fail("Could not identify your current session.");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error: rpcError } = await supabase.rpc("revoke_other_user_sessions", {
    p_current_session: currentSessionId,
  });
  if (rpcError) return fail(rpcError.message);

  const count = typeof data === "number" ? data : Number(data ?? 0);
  await writeLog({
    userId: user.id,
    action: "logout",
    entityType: "profiles",
    entityId: user.id,
    description: `Signed out ${count} other session(s)`,
    ip,
    userAgent: headerStore.get("user-agent"),
    meta: { current_session_id: currentSessionId },
  });

  return ok({ count }, count > 0 ? `Signed out ${count} other session(s).` : "No other active sessions.");
}
