"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/empty-state";
import {
  createCouponAction,
  updateCouponAction,
  deleteCouponAction,
} from "@/lib/actions/admin";
import { adminCouponSchema } from "@/lib/validations";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type CouponRow = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_amount: number | null;
  max_discount: number | null;
  usage_limit: number | null;
  used_count: number;
  per_user_limit: number | null;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

export function AdminCoupons({ coupons }: { coupons: CouponRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<CouponRow | null>(null);
  const [creating, setCreating] = React.useState(false);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="gradient" size="sm" onClick={() => setCreating(true)}>
          <Plus /> New Coupon
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {coupons.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No coupons yet" description="Create a coupon to start promoting your panel." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Code</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Discount</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Usage</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Validity</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((coupon) => {
                    const expired = coupon.expires_at ? new Date(coupon.expires_at).getTime() < Date.now() : false;
                    return (
                      <tr key={coupon.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                              {coupon.code}
                            </span>
                            <button
                              className="text-muted-foreground hover:text-foreground"
                              onClick={async () => {
                                await navigator.clipboard.writeText(coupon.code);
                                toast.success("Copied");
                              }}
                              aria-label="Copy code"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {coupon.discount_type === "percent" ? `${coupon.discount_value}% off` : formatCurrency(coupon.discount_value)}
                          {coupon.min_amount ? (
                            <p className="text-xs text-muted-foreground">min {formatCurrency(coupon.min_amount)}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {coupon.used_count} / {coupon.usage_limit ?? "∞"}
                          <p className="text-muted-foreground">{coupon.per_user_limit} per user</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {coupon.starts_at ? `From ${formatDateTime(coupon.starts_at, "MMM d")}` : "No start"}
                          <p className={expired ? "text-destructive" : ""}>
                            {coupon.expires_at ? `Until ${formatDateTime(coupon.expires_at, "MMM d, yyyy")}` : "Never expires"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={!coupon.is_active ? "destructive" : expired ? "secondary" : "success"}>
                            {!coupon.is_active ? "Disabled" : expired ? "Expired" : "Active"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="iconSm" onClick={() => setEditing(coupon)} aria-label="Edit coupon">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="iconSm"
                              className="text-destructive hover:text-destructive"
                              onClick={async () => {
                                if (!confirm(`Delete coupon ${coupon.code}?`)) return;
                                const result = await deleteCouponAction(coupon.id);
                                if (result.success) {
                                  toast.success("Coupon deleted");
                                  router.refresh();
                                } else {
                                  toast.error(result.error ?? "Failed");
                                }
                              }}
                              aria-label="Delete coupon"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {creating || editing ? (
        <CouponFormDialog coupon={editing} onClose={() => { setEditing(null); setCreating(false); }} />
      ) : null}
    </div>
  );
}

function CouponFormDialog({ coupon, onClose }: { coupon: CouponRow | null; onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const form = useForm<z.infer<typeof adminCouponSchema>>({
    resolver: zodResolver(adminCouponSchema),
    defaultValues: {
      code: coupon?.code ?? "",
      discountType: coupon?.discount_type ?? "percent",
      discountValue: coupon?.discount_value ?? 10,
      minAmount: coupon?.min_amount ?? 0,
      maxDiscount: coupon?.max_discount ?? null,
      usageLimit: coupon?.usage_limit ?? null,
      perUserLimit: coupon?.per_user_limit ?? 1,
      startsAt: coupon?.starts_at ? coupon.starts_at.slice(0, 16) : null,
      expiresAt: coupon?.expires_at ? coupon.expires_at.slice(0, 16) : null,
      isActive: coupon?.is_active ?? true,
    },
  });

  const discountType = form.watch("discountType");

  async function onSubmit(values: z.infer<typeof adminCouponSchema>) {
    setLoading(true);
    try {
      const result = coupon
        ? await updateCouponAction(coupon.id, values)
        : await createCouponAction(values);
      if (result.success) {
        toast.success(result.message ?? "Saved");
        router.refresh();
        onClose();
      } else {
        toast.error(result.error ?? "Failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{coupon ? "Edit Coupon" : "New Coupon"}</DialogTitle>
          <DialogDescription>
            Coupon codes are case-insensitive and can be applied at checkout.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input {...form.register("code")} placeholder="WELCOME10" className="font-mono uppercase" />
            </div>
            <div className="space-y-2">
              <Label>Discount Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={discountType === "percent" ? "default" : "outline"}
                  size="sm"
                  onClick={() => form.setValue("discountType", "percent")}
                >
                  Percent
                </Button>
                <Button
                  type="button"
                  variant={discountType === "fixed" ? "default" : "outline"}
                  size="sm"
                  onClick={() => form.setValue("discountType", "fixed")}
                >
                  Fixed amount
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>{discountType === "percent" ? "Percent (%)" : "Amount (BDT)"}</Label>
              <Input type="number" {...form.register("discountValue")} />
            </div>
            <div className="space-y-2">
              <Label>Minimum Amount</Label>
              <Input type="number" {...form.register("minAmount")} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Max Discount (optional)</Label>
              <Input type="number" {...form.register("maxDiscount")} placeholder="Leave empty" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Usage Limit (optional)</Label>
              <Input type="number" {...form.register("usageLimit")} placeholder="Unlimited" />
            </div>
            <div className="space-y-2">
              <Label>Per User Limit</Label>
              <Input type="number" {...form.register("perUserLimit")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Starts At (optional)</Label>
              <Input type="datetime-local" {...form.register("startsAt")} />
            </div>
            <div className="space-y-2">
              <Label>Expires At (optional)</Label>
              <Input type="datetime-local" {...form.register("expiresAt")} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Allow this coupon to be used</p>
            </div>
            <Switch checked={form.watch("isActive")} onCheckedChange={(v) => form.setValue("isActive", v)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Pencil />}
              Save Coupon
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
