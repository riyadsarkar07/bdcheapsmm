"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Gift, Loader2, Flame, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { claimDailyLoginRewardAction } from "@/lib/actions/rewards";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { LoginReward, LoginStreak } from "@/lib/types/database";

function rewardForDay(day: number): number {
  return Math.min(Math.max(day, 1), 7);
}

export function DailyLogin({
  streak,
  history,
  claimedToday,
  currency,
}: {
  streak: LoginStreak | null;
  history: LoginReward[];
  claimedToday: boolean;
  currency: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const current = streak?.current_streak ?? 0;
  const nextDay = claimedToday ? Math.min(current + 1, 7) : Math.min((current || 0) + 1, 7);
  const nextAmount = rewardForDay(claimedToday ? Math.min(current + 1, 7) : current + 1 || 1);

  async function claim() {
    setLoading(true);
    try {
      const result = await claimDailyLoginRewardAction();
      if (result.success && result.data) {
        toast.success(`Claimed ${formatCurrency(result.data.amount, result.data.currency)}. Streak: ${result.data.streak}`);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to claim");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="h-4 w-4 text-primary" /> Daily Login Reward
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/60 p-3">
              <p className="text-xs text-muted-foreground">Current streak</p>
              <p className="mt-1 flex items-center gap-1 text-2xl font-bold">
                <Flame className="h-5 w-5 text-warning" />
                {current}
              </p>
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <p className="text-xs text-muted-foreground">Longest streak</p>
              <p className="mt-1 text-2xl font-bold">{streak?.longest_streak ?? 0}</p>
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <p className="text-xs text-muted-foreground">Total claims</p>
              <p className="mt-1 text-2xl font-bold">{streak?.total_claims ?? 0}</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">7-day reward ladder</p>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 7 }, (_, i) => {
                const day = i + 1;
                const earned = current >= day && (claimedToday || current > day);
                return (
                  <div
                    key={day}
                    className={`rounded-lg border p-2 text-center text-xs ${
                      earned ? "border-primary/40 bg-primary/10 text-primary" : "bg-muted/40"
                    }`}
                  >
                    <p className="text-[10px] text-muted-foreground">Day {day}</p>
                    <p className="mt-1 font-semibold">{formatCurrency(rewardForDay(day), currency)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm font-medium">
              {claimedToday
                ? `Come back tomorrow for ${formatCurrency(rewardForDay(Math.min(current + 1, 7)), currency)} (day ${Math.min(current + 1, 7)}).`
                : `Next reward: ${formatCurrency(nextAmount, currency)} for day ${claimedToday ? nextDay : Math.min(current + 1, 7) || 1}.`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              One claim per day (Asia/Dhaka). Missing a day resets the streak to 1.
            </p>
          </div>

          <Button variant="gradient" className="w-full" onClick={claim} disabled={loading || claimedToday}>
            {loading ? <Loader2 className="animate-spin" /> : <Gift />}
            {claimedToday ? "Already claimed today" : "Claim today's reward"}
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> Reward history
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <EmptyState title="No claims yet" description="Claim your first daily reward to start a streak." />
          ) : (
            <div className="space-y-2">
              {history.map((row) => (
                <div key={row.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium">Day {row.streak_day}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(row.claim_date)}</p>
                  </div>
                  <p className="font-semibold text-primary">{formatCurrency(row.amount, row.currency)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
