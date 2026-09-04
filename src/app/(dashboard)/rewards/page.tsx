import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { DailyLogin } from "@/components/rewards/daily-login";

export const revalidate = 0;

function dhakaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function RewardsPage() {
  const { user, error } = await requireUser();
  if (error || !user) return null;

  const supabase = await createClient();
  const [{ data: streak }, { data: history }] = await Promise.all([
    supabase.from("login_streaks").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("login_rewards")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const claimedToday = streak?.last_claim_date === dhakaToday();

  return (
    <div>
      <PageHeader
        title="Daily Login Reward"
        description="Earn Coins for logging in. A full 30-day cycle is 150 Coins ($0.15). 1 Coin = $0.001."
      />
      <DailyLogin
        streak={streak}
        history={history ?? []}
        claimedToday={claimedToday}
        coinBalance={user.coin_balance ?? 0}
      />
    </div>
  );
}
