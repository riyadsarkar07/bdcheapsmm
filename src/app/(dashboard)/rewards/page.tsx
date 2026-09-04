import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { DailyLogin } from "@/components/rewards/daily-login";
import type { LoginReward, LoginStreak } from "@/lib/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function dhakaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addIsoDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

export default async function RewardsPage() {
  const { user, error } = await requireUser();
  if (error || !user) return null;

  const supabase = await createClient();
  const today = dhakaToday();

  const [{ data: profile }, { data: streak }, { data: history }] = await Promise.all([
    supabase.from("profiles").select("coin_balance").eq("id", user.id).maybeSingle(),
    supabase
      .from("login_streaks")
      .select(
        "user_id, current_streak, longest_streak, last_claim_date, total_claims, cycle_start_date, cycle_coins, updated_at"
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("login_rewards")
      .select("id, user_id, claim_date, streak_day, amount, currency, transaction_id, coins, usd_value, created_at")
      .eq("user_id", user.id)
      .order("claim_date", { ascending: false })
      .limit(30),
  ]);

  const claimedToday = streak?.last_claim_date === today;
  const streakContinues = streak?.last_claim_date === addIsoDays(today, -1);
  const nextStreak = claimedToday
    ? (streak?.current_streak ?? 0) + 1
    : streakContinues
      ? (streak?.current_streak ?? 0) + 1
      : 1;

  return (
    <div>
      <PageHeader
        title="Daily Login Reward"
        description="Earn Coins for logging in. A full 30-day cycle is 150 Coins ($0.15). 1 Coin = $0.001. Coins are never added to your USD wallet."
      />
      <DailyLogin
        streak={(streak as LoginStreak | null) ?? null}
        history={(history as LoginReward[] | null) ?? []}
        claimedToday={claimedToday}
        coinBalance={Number(profile?.coin_balance ?? user.coin_balance ?? 0)}
        nextStreak={nextStreak}
      />
    </div>
  );
}
