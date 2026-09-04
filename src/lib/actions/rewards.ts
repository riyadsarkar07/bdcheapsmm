"use server";

import { fail, ok, requireUser, type ActionResult } from "@/lib/guards";
import { rateLimit } from "@/lib/rate-limit";

export type ClaimRewardResult = {
  amount: number;
  currency: string;
  streak: number;
  claimDate: string;
  balance: number;
};

export async function claimDailyLoginRewardAction(): Promise<ActionResult<ClaimRewardResult>> {
  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");

  const limited = await rateLimit(`login-reward:${user.id}`, 5, 60);
  if (!limited.success) return fail("Too many attempts. Please wait.");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error: rpcError } = await supabase.rpc("claim_daily_login_reward");

  if (rpcError) {
    const message = rpcError.message ?? "";
    if (message.toLowerCase().includes("already claimed")) {
      return fail("You already claimed today's reward.");
    }
    return fail(message || "Failed to claim reward.");
  }

  const payload = (data ?? {}) as {
    amount?: number;
    currency?: string;
    streak?: number;
    claim_date?: string;
    balance?: number;
  };

  return ok(
    {
      amount: Number(payload.amount ?? 0),
      currency: payload.currency ?? user.currency,
      streak: Number(payload.streak ?? 1),
      claimDate: String(payload.claim_date ?? ""),
      balance: Number(payload.balance ?? 0),
    },
    "Daily reward claimed."
  );
}
