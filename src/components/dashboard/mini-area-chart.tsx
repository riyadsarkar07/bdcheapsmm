"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { cn, formatUsd } from "@/lib/utils";

export type ChartPoint = { label: string; value: number };

/**
 * Serializable value-format descriptor. A function cannot cross the
 * Server -> Client boundary, so callers pass a string that is resolved here.
 */
export type ChartValueFormat = "number" | "usd";

/**
 * A small, dependency-free area chart. Rendered as SVG so it stays crisp on
 * every screen size and never adds a heavy charting dependency to the bundle.
 * Uses a straight-line + area fill; points animate in via CSS only.
 */
export function MiniAreaChart({
  data,
  height = 160,
  valueFormat = "number",
  className,
  accent = "hsl(var(--primary))",
}: {
  data: ChartPoint[];
  height?: number;
  valueFormat?: ChartValueFormat;
  className?: string;
  accent?: string;
}) {
  const formatValue = (value: number) =>
    valueFormat === "usd" ? formatUsd(value) : value.toLocaleString("en-US");
  const reduced = useReducedMotion();
  const [hover, setHover] = React.useState<number | null>(null);
  const id = React.useId().replace(/:/g, "");

  const width = 600;
  const padding = { top: 16, right: 8, bottom: 24, left: 8 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;

  const points = data.map((d, i) => {
    const x = padding.left + (data.length > 1 ? i * stepX : innerW / 2);
    const y = padding.top + innerH - (d.value / max) * innerH;
    return { x, y, ...d };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(
          padding.top + innerH
        ).toFixed(2)} L ${points[0].x.toFixed(2)} ${(padding.top + innerH).toFixed(
          2
        )} Z`
      : "";

  const active = hover != null ? points[hover] : null;

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground",
          className
        )}
        style={{ height }}
      >
        No activity yet
      </div>
    );
  }

  return (
    <div className={cn("relative w-full", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label="Spending over the last 7 days"
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
        style={{ height }}
      >
        <defs>
          <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.25" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={ratio}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + innerH * ratio}
            y2={padding.top + innerH * ratio}
            stroke="hsl(var(--border))"
            strokeDasharray="4 6"
            strokeWidth="1"
          />
        ))}

        <path d={areaPath} fill={`url(#area-${id})`} />
        <path
          d={linePath}
          fill="none"
          stroke={accent}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={reduced ? undefined : "animate-fade-in"}
        />

        {points.map((p, i) => (
          <g key={p.label}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hover === i ? 5 : 3.5}
              fill="hsl(var(--card))"
              stroke={accent}
              strokeWidth="2"
              className="transition-all duration-150"
            />
            <rect
              x={p.x - stepX / 2}
              y={padding.top}
              width={stepX}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              tabIndex={0}
              role="button"
              aria-label={`${p.label}: ${formatValue(p.value)}`}
              className="cursor-pointer outline-none"
            />
            <text
              x={p.x}
              y={height - 6}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {p.label}
            </text>
          </g>
        ))}

        {active ? (
          <line
            x1={active.x}
            x2={active.x}
            y1={padding.top}
            y2={padding.top + innerH}
            stroke={accent}
            strokeOpacity="0.35"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        ) : null}
      </svg>

      {active ? (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-popover"
          style={{
            left: `${(active.x / width) * 100}%`,
            top: 0,
          }}
        >
          <p className="font-semibold">
            {formatValue(active.value)}
          </p>
          <p className="text-[10px] text-muted-foreground">{active.label}</p>
        </div>
      ) : null}
    </div>
  );
}
