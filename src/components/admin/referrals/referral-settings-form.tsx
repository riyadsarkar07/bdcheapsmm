"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateReferralSettingsAction } from "@/lib/actions/referrals";

export function ReferralSettingsForm({
  initialRate,
  initialEnabled,
}: {
  initialRate: number;
  initialEnabled: boolean;
}) {
  const router = useRouter();
  const [rate, setRate] = React.useState(String(initialRate));
  const [enabled, setEnabled] = React.useState(initialEnabled);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await updateReferralSettingsAction({
        ratePercent: rate,
        enabled,
      });
      if (result.success) {
        toast.success(result.message ?? "Referral settings saved.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to save settings");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Commission Settings</CardTitle>
        <CardDescription>
          Commission is credited to the referrer only when a referred user&apos;s deposit is approved.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rate">Commission Rate (%)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="rate"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-40"
                placeholder="5"
              />
              <span className="text-sm text-muted-foreground">% of each approved deposit</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="enabled">Enable referrals</Label>
              <p className="text-xs text-muted-foreground">
                When disabled, no new commissions are granted and referral links stop earning.
              </p>
            </div>
            <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Save />}
            Save Settings
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
