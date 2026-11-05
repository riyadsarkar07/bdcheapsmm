import Link from "next/link";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href="/"
      className={cn("group flex items-center gap-2.5", className)}
      aria-label="BD Cheap SMM home"
    >
      <div className="gradient-bg relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-md shadow-primary/25 transition-transform duration-200 group-hover:scale-105">
        <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
      </div>
      {compact ? null : (
        <div className="leading-tight">
          <span className="text-sm font-bold tracking-tight">
            BD <span className="gradient-text">Cheap SMM</span>
          </span>
        </div>
      )}
    </Link>
  );
}
