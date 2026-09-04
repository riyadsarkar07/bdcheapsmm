"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Gift, Loader2, Flame, History, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Progress } from "@/components/ui/progress";
import { claimDailyLoginRewardAction } from "@/lib/actions/rewards";
import {
  LOGIN_CYCLE_MAX_COINS,
  LOGIN_LADDER,
  coinsForStreakDay,
  formatCoinUsd,
  formatCoins,
  rewardCoinsFromRow,
  thirtyDaySchedule,
} from "@/lib/coins";
import { formatDate } from "@/lib/utils";
import type { LoginReward, LoginStreak } from "@/lib/types/database";

export function DailyLogin({
  streak,
  history,
  claimedToday,
  coinBalance,
  nextStreak,
}: {
  streak: LoginStreak | null;
  history: LoginReward[];
  claimedToday: boolean;
  coinBalance: number;
  nextStreak: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const current = streak?.current_streak ?? 0;
  const cycleCoins = Math.min(LOGIN_CYCLE_MAX_COINS, Math.max(0, streak?.cycle_coins ?? 0));
  const cycleRemaining = Math.max(0, LOGIN_CYCLE_MAX_COINS - cycleCoins);
  const nextLadderCoins = coinsForStreakDay(nextStreak);
  const nextCoins = Math.min(nextLadderCoins, cycleRemaining);
  const cyclePercent = Math.min(100, Math.round((cycleCoins / LOGIN_CYCLE_MAX_COINS) * 100));
  const schedule = thirtyDaySchedule();
  const position = current === 0 ? 0 : ((current - 1) % 7) + 1;

  async function claim() {
    setLoading(true);
    try {
      const result = await claimDailyLoginRewardAction();
      if (result.success && result.data) {
        toast.success(
          `Claimed ${formatCoins(result.data.coins)} (${formatCoinUsd(result.data.coins)}). Streak: ${result.data.streak}`
        );
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-muted/60 p-3">
              <p className="text-xs text-muted-foreground">Coin balance</p>
              <p className="mt-1 flex items-center gap-1 text-xl font-bold">
                <Coins className="h-4 w-4 text-primary" />
                {coinBalance.toLocaleString("en-US")}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{formatCoinUsd(coinBalance)}</p>
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <p className="text-xs text-muted-foreground">Current streak</p>
              <p className="mt-1 flex items-center gap-1 text-xl font-bold">
                <Flame className="h-4 w-4 text-warning" />
                {current}
              </p>
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <p className="text-xs text-muted-foreground">Longest streak</p>
              <p className="mt-1 text-xl font-bold">{streak?.longest_streak ?? 0}</p>
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <p className="text-xs text-muted-foreground">Total claims</p>
              <p className="mt-1 text-xl font-bold">{streak?.total_claims ?? 0}</p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <p className="font-medium">30-day cycle</p>
              <p className="text-xs text-muted-foreground">
                {cycleCoins}/{LOGIN_CYCLE_MAX_COINS} Coins ({formatCoinUsd(cycleCoins)} / $0.150)
              </p>
            </div>
            <Progress value={cyclePercent} />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Full cycle max is 150 Coins = $0.15. 1 Coin = $0.001. Coins are stored separately from wallet balance.
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">7-day reward ladder</p>
            <div className="grid grid-cols-7 gap-1.5">
              {LOGIN_LADDER.map((coins, i) => {
                const day = i + 1;
                const earned = claimedToday ? position >= day : position > day;
                const isNext =
                  !claimedToday && (current === 0 ? day === 1 : ((nextStreak - 1) % 7) + 1 === day);
                return (
                  <div
                    key={day}
                    className={`rounded-lg border p-2 text-center text-xs ${
                      earned
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : isNext
                          ? "border-warning/40 bg-warning/10"
                          : "bg-muted/40"
                    }`}
                  >
                    <p className="text-[10px] text-muted-foreground">Day {day}</p>
                    <p className="mt-1 font-semibold">{coins} Coins</p>
                    <p className="text-[10px] text-muted-foreground">{formatCoinUsd(coins)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">30-day coin schedule</p>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10">
              {schedule.map((coins, i) => {
                const day = i + 1;
                return (
                  <div key={day} className="rounded-md bg-muted/40 p-1.5 text-center">
                    <p className="text-[10px] text-muted-foreground">D{day}</p>
                    <p className="text-[11px] font-semibold">{coins}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              4 weeks of 36 Coins plus Day 29-30 (3 + 3) = exactly 150 Coins ($0.15).
            </p>
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm font-medium">
              {claimedToday
                ? cycleRemaining === 0
                  ? "This 30-day cycle is complete (150 Coins / $0.15). Next cycle starts after 30 days."
                  : `Come back tomorrow for ${formatCoins(nextCoins)} (${formatCoinUsd(nextCoins)}).`
                : cycleRemaining === 0
                  ? "This 30-day cycle already reached 150 Coins ($0.15). Claims resume in the next cycle."
                  : `Next reward: ${formatCoins(nextCoins)} (${formatCoinUsd(nextCoins)}).`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              One claim per Dhaka calendar day. Missing a day resets the 7-day streak to Day 1. Duplicate claims are blocked. USD wallet is never credited.
            </p>
          </div>

          <Button
            variant="gradient"
            className="w-full"
            onClick={claim}
            disabled={loading || claimedToday || (!claimedToday && cycleRemaining === 0)}
          >
            {loading ? <Loader2 className="animate-spin" /> : <Gift />}
            {claimedToday ? "Already claimed today" : cycleRemaining === 0 ? "Cycle complete" : "Claim today's coins"}
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
              {history.map((row) => {
                const coins = rewardCoinsFromRow(row);
                return (
                  <div key={row.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div>
                      <p className="font-medium">Day {((row.streak_day - 1) % 7) + 1}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(row.claim_date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary">{formatCoins(coins)}</p>
                      <p className="text-[11px] text-muted-foreground">{formatCoinUsd(coins)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
