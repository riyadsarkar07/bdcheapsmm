"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function CopyButton({
  value,
  className,
  label,
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="iconSm"
      className={cn("h-7 w-7", className)}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
      }}
      aria-label={label ?? "Copy to clipboard"}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}
