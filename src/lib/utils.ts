import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNowStrict } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency = "BDT"
): string {
  const value = Number(amount ?? 0);
  if (currency === "BDT") {
    return "৳" + value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

export function formatNumber(value: number | string | null | undefined): string {
  const num = Number(value ?? 0);
  return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function formatDate(
  date: string | Date | null | undefined,
  pattern = "MMM d, yyyy"
): string {
  if (!date) return "—";
  return format(new Date(date), pattern);
}

export function formatDateTime(
  date: string | Date | null | undefined,
  pattern = "MMM d, yyyy h:mm a"
): string {
  if (!date) return "—";
  return format(new Date(date), pattern);
}

export function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return formatDistanceToNowStrict(new Date(date), { addSuffix: true });
}

export function generateOrderNumber(): string {
  return (
    "SMM" +
    new Date().getFullYear().toString().slice(2) +
    Math.floor(100000 + Math.random() * 900000).toString()
  );
}

export function generateTicketNumber(): string {
  return "TK-" + Date.now().toString().slice(-8);
}

export function generateApiKeyPrefix(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return "smm_" + out;
}

export function generateApiKeySecret(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function truncate(str: string | null | undefined, length = 60): string {
  if (!str) return "";
  return str.length > length ? str.slice(0, length - 3) + "..." : str;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getInitials(name?: string | null): string {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
