"use client";

import { Share2, Link2, MessageCircle, Send, Facebook, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";

function openShare(url: string) {
  window.open(url, "_blank", "noopener,noreferrer,width=600,height=600");
}

export function ReferralLinkCard({
  code,
  link,
  ratePercent,
  enabled,
}: {
  code: string;
  link: string;
  ratePercent: number;
  enabled: boolean;
}) {
  const encoded = encodeURIComponent(link);
  const text = encodeURIComponent(
    "Join us and start ordering! Use my referral link to sign up and I earn a commission on your deposits."
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Share2 className="h-4 w-4" /> Your Referral Link
        </CardTitle>
        <CardDescription>
          {enabled
            ? `You earn ${ratePercent}% of every approved deposit from users who sign up with your link.`
            : "Referral commissions are currently disabled by the admin."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="h-10 w-full rounded-lg border bg-muted/50 pr-10 pl-9 text-sm text-muted-foreground"
              aria-label="Referral link"
            />
          </div>
          <CopyButton value={link} label="Copy referral link" />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => openShare(`https://wa.me/?text=${text}%0A${encoded}`)}
          >
            <MessageCircle className="h-4 w-4 text-success" /> WhatsApp
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => openShare(`https://t.me/share/url?url=${encoded}&text=${text}`)}
          >
            <Send className="h-4 w-4 text-primary" /> Telegram
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => openShare(`https://www.facebook.com/sharer/sharer.php?u=${encoded}`)}
          >
            <Facebook className="h-4 w-4 text-primary" /> Facebook
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => openShare(`https://twitter.com/intent/tweet?url=${encoded}&text=${text}`)}
          >
            <Twitter className="h-4 w-4 text-primary" /> X
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Your code: <span className="font-mono font-semibold text-foreground">{code}</span>
        </p>
      </CardContent>
    </Card>
  );
}
