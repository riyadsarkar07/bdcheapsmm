"use server";

import { fail, ok, requireUser, type ActionResult } from "@/lib/guards";
import { rateLimit } from "@/lib/rate-limit";

export type ClaimRewardResult = {
  coins: number;
  usdValue: number;
  streak: number;
  claimDate: string;
  coinBalance: number;
  cycleCoins: number;
  cycleRemaining: number;
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
    coins?: number;
    usd_value?: number;
    streak?: number;
    claim_date?: string;
    coin_balance?: number;
    cycle_coins?: number;
    cycle_remaining?: number;
  };

  return ok(
    {
      coins: Number(payload.coins ?? 0),
      usdValue: Number(payload.usd_value ?? 0),
      streak: Number(payload.streak ?? 1),
      claimDate: String(payload.claim_date ?? ""),
      coinBalance: Number(payload.coin_balance ?? 0),
      cycleCoins: Number(payload.cycle_coins ?? 0),
      cycleRemaining: Number(payload.cycle_remaining ?? 0),
    },
    "Daily reward claimed."
  );
}
