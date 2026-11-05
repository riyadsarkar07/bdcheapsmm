"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion, useReducedMotion } from "framer-motion";
import {
  Loader2,
  ShoppingCart,
  Tag,
  Zap,
  AlertTriangle,
  Wallet,
  Clock,
  ShieldCheck,
  Minus,
  Plus,
  CheckCircle2,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { createOrderAction } from "@/lib/actions/orders";
import { checkUrlConflictAction, type UrlConflict } from "@/lib/actions/url-check";
import { formatUsd } from "@/lib/utils";
import { computeOrderCharge, formatChargeUsd, hasSufficientBalance } from "@/lib/pricing";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  quantity: z.coerce
    .number()
    .int("Whole number required")
    .min(1, "Quantity is required"),
  link: z
    .string()
    .min(5, "Link is required")
    .max(2048)
    .refine((v) => /^https?:\/\/.+/i.test(v), "Enter a valid URL starting with http:// or https://"),
  coupon: z.string().max(50).optional().or(z.literal("")),
});

interface OrderFormProps {
  serviceId: string;
  serviceName: string;
  /** Retail price per 1000 units (same as the provider rate + markup). */
  pricePerUnit: number;
  minQuantity: number;
  maxQuantity: number;
  balance: number;
  linkPlaceholder?: string;
  /** Human-readable provider ETA, e.g. "0-1 hours". */
  averageTime?: string | null;
}

export function OrderForm({
  serviceId,
  serviceName,
  pricePerUnit,
  minQuantity,
  maxQuantity,
  balance,
  linkPlaceholder,
  averageTime,
}: OrderFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const reduced = useReducedMotion();
  const [loading, setLoading] = React.useState(false);
  const submittingRef = React.useRef(false);
  const [couponStatus, setCouponStatus] = React.useState<
    "idle" | "applied" | "invalid"
  >("idle");
  const [conflicts, setConflicts] = React.useState<UrlConflict[] | null>(null);
  const [pendingValues, setPendingValues] = React.useState<z.infer<typeof formSchema> | null>(null);
  const [confirmValues, setConfirmValues] = React.useState<z.infer<typeof formSchema> | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { quantity: minQuantity, link: "", coupon: "" },
  });

  const quantity = form.watch("quantity") || 0;
  // pricePerUnit is per 1000 units, so the total is (price/1000) x quantity.
  const total = computeOrderCharge(pricePerUnit, quantity);
  const balanceAfter = Math.max(0, Number(balance) - total);

  const presets = React.useMemo(() => {
    const candidates = [minQuantity, 1000, 5000, 10000, 50000];
    const unique = Array.from(new Set(candidates)).filter(
      (n) => n >= minQuantity && n <= maxQuantity
    );
    return unique.slice(0, 4);
  }, [minQuantity, maxQuantity]);

  async function placeOrder(values: z.infer<typeof formSchema>) {
    const cost = computeOrderCharge(pricePerUnit, values.quantity);
    if (!hasSufficientBalance(balance, cost)) {
      toast.error(
        `Insufficient balance. Please add funds to place this order. Required: ${formatChargeUsd(cost)}. Current balance: ${formatChargeUsd(balance)}.`
      );
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      const result = await createOrderAction({
        serviceId,
        quantity: values.quantity,
        link: values.link,
        coupon: values.coupon,
      });
      if (result.success && result.data) {
        toast.success(`Order ${result.data.orderNumber} placed successfully!`);
        setCouponStatus("idle");
        form.setValue("coupon", "");
        setConflicts(null);
        setPendingValues(null);
        setConfirmValues(null);
        queryClient.invalidateQueries({ queryKey: ["profile-balance"] });
        router.push(`/orders/${result.data.orderId}`);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to place order");
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const cost = computeOrderCharge(pricePerUnit, values.quantity);
    if (!hasSufficientBalance(balance, cost)) {
      toast.error(
        `Insufficient balance. Please add funds to place this order. Required: ${formatChargeUsd(cost)}. Current balance: ${formatChargeUsd(balance)}.`
      );
      return;
    }
    if (submittingRef.current) return;
    setLoading(true);
    try {
      const check = await checkUrlConflictAction({ link: values.link, serviceId });
      const found = check.success ? (check.data?.conflicts ?? []) : [];
      if (found.length > 0) {
        setPendingValues(values);
        setConflicts(found);
        return;
      }
      setConfirmValues(values);
    } finally {
      setLoading(false);
    }
  }

  const insufficient = !hasSufficientBalance(balance, total);

  function adjustQuantity(delta: number) {
    const current = Number(form.getValues("quantity")) || minQuantity;
    const next = Math.min(maxQuantity, Math.max(minQuantity, current + delta));
    form.setValue("quantity", next, { shouldValidate: true });
  }

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-5 sm:p-6"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <ShoppingCart className="h-5 w-5 text-primary" /> Place Order
          </h2>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{serviceName}</p>
        </div>
        <Badge variant="info" className="shrink-0">
          {formatUsd(pricePerUnit)} / 1k
        </Badge>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Quantity</FormLabel>
                  <span className="text-[11px] text-muted-foreground">
                    {minQuantity.toLocaleString()} – {maxQuantity.toLocaleString()}
                  </span>
                </div>
                <FormControl>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={() => adjustQuantity(-100)}
                      aria-label="Decrease quantity"
                      disabled={Number(field.value) <= minQuantity}
                    >
                      <Minus />
                    </Button>
                    <Input
                      type="number"
                      min={minQuantity}
                      max={maxQuantity}
                      placeholder="1000"
                      className="text-center tabular-nums"
                      {...field}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={() => adjustQuantity(100)}
                      aria-label="Increase quantity"
                      disabled={Number(field.value) >= maxQuantity}
                    >
                      <Plus />
                    </Button>
                  </div>
                </FormControl>
                {presets.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {presets.map((preset) => {
                      const active = Number(field.value) === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => form.setValue("quantity", preset, { shouldValidate: true })}
                          className={
                            "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors " +
                            (active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground")
                          }
                        >
                          {preset.toLocaleString()}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="link"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target Link</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder={linkPlaceholder ?? "https://www.instagram.com/p/..."}
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="coupon"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Coupon (optional)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Tag className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Discount code"
                      className="pl-9"
                      onChange={(e) => {
                        field.onChange(e);
                        setCouponStatus("idle");
                      }}
                      value={field.value}
                      onBlur={field.onBlur}
                      name={field.name}
                    />
                  </div>
                </FormControl>
                {couponStatus === "applied" ? (
                  <p className="flex items-center gap-1 text-xs text-success">
                    <CheckCircle2 className="h-3 w-3" /> Coupon applied!
                  </p>
                ) : null}
                {couponStatus === "invalid" ? (
                  <p className="text-xs text-destructive">Invalid coupon</p>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="rounded-xl border bg-muted/40 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Quantity</span>
              <span className="font-medium tabular-nums">{quantity.toLocaleString()}</span>
            </div>
            <div className="mt-1.5 flex justify-between text-sm">
              <span className="text-muted-foreground">Rate (per 1k)</span>
              <span className="tabular-nums">{formatUsd(pricePerUnit)}</span>
            </div>
            {averageTime ? (
              <div className="mt-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> Est. delivery
                </span>
                <span>{averageTime}</span>
              </div>
            ) : null}
            <div className="mt-2.5 flex items-center justify-between border-t pt-2.5">
              <span className="font-medium">Total</span>
              <span className="text-xl font-bold text-primary tabular-nums">
                {formatUsd(total)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Balance after order</span>
              <span className={insufficient ? "font-semibold text-destructive" : "font-semibold text-success"}>
                {formatUsd(balanceAfter)}
              </span>
            </div>
          </div>

          {insufficient ? (
            <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="space-y-1">
                  <p className="font-semibold text-destructive">
                    Insufficient balance. Please add funds to place this order.
                  </p>
                  <p className="text-muted-foreground">
                    Required: {formatUsd(total)} · Current balance: {formatUsd(balance)}
                  </p>
                </div>
              </div>
              <Button asChild variant="gradient" size="sm" className="w-full">
                <a href="/add-funds">
                  <Wallet /> Add Funds
                </a>
              </Button>
            </div>
          ) : null}

          <Button type="submit" variant="gradient" className="w-full" disabled={loading || insufficient}>
            {loading ? <Loader2 className="animate-spin" /> : <Zap />}
            {insufficient ? "Insufficient Balance" : "Review Order"}
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure checkout · charged from your wallet
          </p>
        </form>
      </Form>

      {/* Duplicate URL warning */}
      <Dialog open={!!conflicts} onOpenChange={(open) => !open && setConflicts(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Duplicate URL warning
            </DialogTitle>
            <DialogDescription>
              This link already has an active order. Continuing may overlap delivery. Confirm only if this is intentional.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(conflicts ?? []).map((c) => (
              <div key={c.orderId} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">#{c.orderNumber}</p>
                  <Badge variant="warning">{c.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.serviceName ?? "Service"} · Qty {c.quantity.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConflicts(null); setPendingValues(null); }}>
              Cancel
            </Button>
            <Button
              variant="gradient"
              disabled={!pendingValues}
              onClick={() => {
                setConfirmValues(pendingValues);
                setConflicts(null);
              }}
            >
              Continue anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order confirmation */}
      <Dialog open={!!confirmValues} onOpenChange={(open) => !open && !loading && setConfirmValues(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Confirm your order
            </DialogTitle>
            <DialogDescription>
              Review the details below. Your wallet is charged immediately after confirming.
            </DialogDescription>
          </DialogHeader>
          {confirmValues ? (
            <div className="space-y-2 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Service</p>
                <p className="mt-0.5 line-clamp-2 font-medium">{serviceName}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Quantity</p>
                  <p className="mt-0.5 font-semibold tabular-nums">
                    {confirmValues.quantity.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Total charge</p>
                  <p className="mt-0.5 font-semibold text-primary tabular-nums">
                    {formatUsd(computeOrderCharge(pricePerUnit, confirmValues.quantity))}
                  </p>
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Target link</p>
                <p className="mt-0.5 break-all font-mono text-xs">{confirmValues.link}</p>
              </div>
              {averageTime ? (
                <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> Estimated delivery
                  </span>
                  <span className="text-xs font-medium">{averageTime}</span>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmValues(null)}
              disabled={loading}
            >
              Back
            </Button>
            <Button
              variant="gradient"
              disabled={loading || !confirmValues}
              onClick={() => confirmValues && placeOrder(confirmValues)}
            >
              {loading ? <Loader2 className="animate-spin" /> : <Zap />}
              Confirm & Place Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
