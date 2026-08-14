"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Eye, CheckCircle2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { applyGlobalProfitAction, previewGlobalProfitAction } from "@/lib/actions/admin";
import { formatUsd } from "@/lib/utils";

type Rounding = "round2" | "round" | "ceil";

type PreviewRow = {
  id: string;
  name: string;
  price: number;
  newPrice: number;
  providerPrice: number;
};

export function AdminPricing({
  initialGlobalProfit,
  initialRounding,
  globalServiceCount,
}: {
  initialGlobalProfit: number | null;
  initialRounding: Rounding;
  globalServiceCount: number;
}) {
  const router = useRouter();
  const [profit, setProfit] = React.useState(initialGlobalProfit?.toString() ?? "");
  const [rounding, setRounding] = React.useState<Rounding>(initialRounding);
  const [preview, setPreview] = React.useState<PreviewRow[] | null>(null);
  const [previewTotal, setPreviewTotal] = React.useState<number | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const parsedProfit = Number(profit);

  async function handlePreview() {
    if (!Number.isFinite(parsedProfit)) {
      toast.error("Enter a valid profit percentage.");
      return;
    }
    setPreviewing(true);
    try {
      const result = await previewGlobalProfitAction({ profitPercentage: parsedProfit, rounding });
      if (result.success) {
        setPreview(result.data?.preview ?? []);
        setPreviewTotal(result.data?.total ?? null);
        setDialogOpen(true);
      } else {
        toast.error(result.error ?? "Preview failed");
      }
    } finally {
      setPreviewing(false);
    }
  }

  async function handleApply() {
    if (!Number.isFinite(parsedProfit)) {
      toast.error("Enter a valid profit percentage.");
      return;
    }
    setApplying(true);
    try {
      const result = await applyGlobalProfitAction({ profitPercentage: parsedProfit, rounding });
      if (result.success) {
        toast.success(result.message ?? "Applied");
        setDialogOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Apply failed");
      }
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Global Profit
          </CardTitle>
          <CardDescription>
            Selling price = provider cost + (provider cost &times; profit % / 100). Only applies to
            services in <Badge variant="subtle" className="px-1.5 py-0">Global Markup</Badge> mode
            ({globalServiceCount.toLocaleString()} eligible). Custom-price services are never changed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Global Profit %</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 20"
                value={profit}
                onChange={(e) => setProfit(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Rounding</Label>
              <Select value={rounding} onValueChange={(v) => setRounding(v as Rounding)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="round2">2 decimal places (1.2345 &rarr; 1.23)</SelectItem>
                  <SelectItem value="round">Nearest integer (1.50 &rarr; 2)</SelectItem>
                  <SelectItem value="ceil">Always round up (1.01 &rarr; 2)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handlePreview} disabled={previewing}>
              {previewing ? <Loader2 className="animate-spin" /> : <Eye />}
              Preview Changes
            </Button>
            <Button variant="gradient" onClick={handleApply} disabled={applying}>
              {applying ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              Apply Global Profit
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How pricing works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <Badge variant="subtle" className="mr-1 px-1.5 py-0">Global Markup</Badge>
            Price is auto-calculated from the provider cost using the global profit %. Applying the
            global profit or syncing a provider will update these prices.
          </p>
          <p>
            <Badge variant="secondary" className="mr-1 px-1.5 py-0">Custom Price</Badge>
            The price you set manually is final. Global profit applies and provider syncs never
            overwrite it. Set this on the Services page when editing a service.
          </p>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview Global Profit</DialogTitle>
            <DialogDescription>
              {previewTotal ?? 0} global-markup service(s) will change. Custom-price services are
              excluded.
              {previewTotal !== null && previewTotal > (preview?.length ?? 0) ? (
                <span className="mt-1 block text-muted-foreground">
                  Showing the first {preview?.length ?? 0} services as a preview.
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          {preview && preview.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Service</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Current</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">New</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="max-w-[220px] truncate px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2 text-right">{formatUsd(row.price)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-primary">
                        {formatUsd(row.newPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-4">
              <EmptyState title="No eligible services" description="No global-markup services with a provider price were found." />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleApply} disabled={applying || (previewTotal ?? 0) === 0}>
              {applying ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              Apply to {previewTotal ?? 0} services
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
