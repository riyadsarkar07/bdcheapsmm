export const COIN_USD_VALUE = 0.001;
export const LOGIN_CYCLE_DAYS = 30;
export const LOGIN_CYCLE_MAX_COINS = 150;
export const LOGIN_LADDER = [3, 4, 5, 5, 6, 7, 10] as const;

export function coinsForStreakDay(streak: number): number {
  const day = Math.max(1, Math.floor(streak));
  return LOGIN_LADDER[(day - 1) % LOGIN_LADDER.length];
}

export function coinsToUsd(coins: number): number {
  return Number(coins) * COIN_USD_VALUE;
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
