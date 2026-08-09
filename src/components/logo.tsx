import Link from "next/link";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2", className)}>
      <div className="gradient-bg flex h-8 w-8 items-center justify-center rounded-lg shadow-lg shadow-fuchsia-500/25">
        <Zap className="h-4.5 w-4.5 h-5 w-5 text-white" />
      </div>
      <div className="leading-tight">
        <span className="text-sm font-bold tracking-tight">
          BD <span className="gradient-text">Cheap SMM</span>
        </span>
      </div>
    </Link>
  );
}
