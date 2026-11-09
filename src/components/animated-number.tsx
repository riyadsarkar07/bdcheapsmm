"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { formatCurrency, formatUsd } from "@/lib/utils";

/**
 * Serializable formatter descriptor.
 *
 * These components are rendered from Server Components, so a formatter
 * *function* cannot be passed as a prop (React Server Components cannot
 * serialize functions across the server -> client boundary). Instead callers
 * pass a plain string that the client component resolves to a real formatter.
 */
export type NumberFormatKind = "number" | "usd" | "currency";

/**
 * Smoothly counts from the previous value to the next one. Falls back to an
 * instant swap when the user prefers reduced motion. Kept dependency-free and
 * cheap (a single rAF loop) so it can be used in dashboard grids without
 * causing re-render storms elsewhere.
 */
export function AnimatedNumber({
  value,
  format = "number",
  currency = "BDT",
  duration = 500,
  className,
}: {
  value: number;
  format?: NumberFormatKind;
  currency?: string;
  duration?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = React.useState(value);
  const fromRef = React.useRef(value);
  const frameRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (reduced) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }

    const from = fromRef.current;
    const to = Number.isFinite(value) ? value : 0;
    if (from === to) {
      setDisplay(to);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      setDisplay(next);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration, reduced]);

  const shown = Number.isFinite(display) ? display : 0;

  let text: string;
  if (format === "usd") {
    text = formatUsd(shown);
  } else if (format === "currency") {
    text = formatCurrency(shown, currency);
  } else {
    text = Math.round(shown).toLocaleString("en-US");
  }

  return <span className={className}>{text}</span>;
}
