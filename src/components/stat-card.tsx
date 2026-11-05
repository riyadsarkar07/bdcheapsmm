"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  description?: string;
  color?: "primary" | "success" | "warning" | "destructive" | "info";
  delay?: number;
  className?: string;
  /** Optional trailing element rendered under the value (e.g. a trend chip). */
  footer?: React.ReactNode;
}

const colorMap = {
  primary: {
    icon: "bg-primary/10 text-primary",
    accent: "bg-primary",
  },
  success: {
    icon: "bg-success/10 text-success",
    accent: "bg-success",
  },
  warning: {
    icon: "bg-warning/10 text-warning",
    accent: "bg-warning",
  },
  destructive: {
    icon: "bg-destructive/10 text-destructive",
    accent: "bg-destructive",
  },
  info: {
    icon: "bg-info/10 text-info",
    accent: "bg-info",
  },
} as const;

export function StatCard({
  title,
  value,
  icon,
  description,
  color = "primary",
  delay = 0,
  className,
  footer,
}: StatCardProps) {
  const reduced = useReducedMotion();
  const palette = colorMap[color];

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "glass-card group relative overflow-hidden p-4 transition-[box-shadow,border-color] duration-200 hover:border-primary/20 hover:shadow-elevated sm:p-5",
        className
      )}
    >
      <span
        className={cn(
          "absolute inset-x-0 top-0 h-0.5 opacity-60 transition-opacity group-hover:opacity-100",
          palette.accent
        )}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">
            {title}
          </p>
          <p className="tabular truncate text-xl font-bold tracking-tight sm:text-2xl">
            {value}
          </p>
          {description ? (
            <p className="truncate text-xs text-muted-foreground">{description}</p>
          ) : null}
          {footer}
        </div>
        {icon ? (
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10",
              palette.icon
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
