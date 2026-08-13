"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  description?: string;
  color?: "primary" | "success" | "warning" | "destructive" | "info";
  delay?: number;
  className?: string;
}

const colorMap = {
  primary: "from-violet-500 to-fuchsia-500 shadow-violet-500/25",
  success: "from-emerald-500 to-teal-500 shadow-emerald-500/25",
  warning: "from-amber-500 to-orange-500 shadow-amber-500/25",
  destructive: "from-rose-500 to-red-500 shadow-rose-500/25",
  info: "from-sky-500 to-blue-500 shadow-sky-500/25",
};

export function StatCard({
  title,
  value,
  icon,
  description,
  color = "primary",
  delay = 0,
  className,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={cn("glass-card rounded-xl p-5", className)}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-lg",
            colorMap[color]
          )}
        >
          {icon}
        </div>
      </div>
    </motion.div>
  );
}
