"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Smoothly counts from the previous value to the next one. Falls back to an
 * instant swap when the user prefers reduced motion. Kept dependency-free and
 * cheap (a single rAF loop) so it can be used in dashboard grids without
 * causing re-render storms elsewhere.
 */
export function AnimatedNumber({
  value,
  format,
  duration = 500,
  className,
}: {
  value: number;
  format?: (value: number) => string;
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

  return (
    <span className={className}>
      {format ? format(shown) : Math.round(shown).toLocaleString("en-US")}
    </span>
  );
}
