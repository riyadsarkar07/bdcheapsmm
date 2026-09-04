export const COIN_USD_VALUE = 0.001;
export const LOGIN_CYCLE_DAYS = 30;
export const LOGIN_CYCLE_MAX_COINS = 150;
export const LOGIN_CYCLE_MAX_USD = LOGIN_CYCLE_MAX_COINS * COIN_USD_VALUE;

export const LOGIN_LADDER = [3, 3, 4, 5, 6, 7, 8] as const;

export function coinsForStreakDay(streak: number): number {
  const day = Math.max(1, Math.floor(Number(streak) || 1));
  return LOGIN_LADDER[(day - 1) % LOGIN_LADDER.length];
}

export function thirtyDaySchedule(): number[] {
  return Array.from({ length: LOGIN_CYCLE_DAYS }, (_, index) => LOGIN_LADDER[index % LOGIN_LADDER.length]);
}

export function thirtyDayScheduleTotal(): number {
  return thirtyDaySchedule().reduce((sum, coins) => sum + coins, 0);
}

export function coinsToUsd(coins: number): number {
  return (Number(coins) || 0) * COIN_USD_VALUE;
}

export function formatCoins(coins: number): string {
  const value = Number(coins) || 0;
  return `${value.toLocaleString("en-US")} Coin${value === 1 ? "" : "s"}`;
}

export function formatCoinUsd(coins: number): string {
  return (
    "$" +
    coinsToUsd(coins).toLocaleString("en-US", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })
  );
}

export function rewardCoinsFromRow(row: {
  coins?: number | null;
  usd_value?: number | null;
  amount?: number | null;
  currency?: string | null;
}): number {
  if (row.coins != null && Number.isFinite(Number(row.coins))) {
    return Math.max(0, Math.trunc(Number(row.coins)));
  }
  if (String(row.currency ?? "").toUpperCase() === "COIN" && row.amount != null) {
    return Math.max(0, Math.trunc(Number(row.amount)));
  }
  return 0;
}
