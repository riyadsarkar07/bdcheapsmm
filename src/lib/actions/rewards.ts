"use server";

import { revalidatePath } from "next/cache";
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
    const lower = message.toLowerCase();
    if (lower.includes("already claimed")) {
      return fail("You already claimed today's reward.");
    }
    if (lower.includes("cycle coin limit")) {
      return fail("This 30-day cycle already reached 150 Coins ($0.15).");
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

  const coins = Math.max(0, Math.trunc(Number(payload.coins ?? 0)));
  const usdValue = Number(payload.usd_value ?? coins * 0.001);

  revalidatePath("/rewards");
  revalidatePath("/dashboard");

  return ok(
    {
      coins,
      usdValue,
      streak: Number(payload.streak ?? 1),
      claimDate: String(payload.claim_date ?? ""),
      coinBalance: Number(payload.coin_balance ?? 0),
      cycleCoins: Number(payload.cycle_coins ?? 0),
      cycleRemaining: Number(payload.cycle_remaining ?? 0),
    },
    "Daily reward claimed."
  );
}
