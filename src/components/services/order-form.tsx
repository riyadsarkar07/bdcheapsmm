"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Loader2, ShoppingCart, Tag, Zap, AlertTriangle } from "lucide-react";
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
import { computeOrderCharge } from "@/lib/pricing";
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
}

export function OrderForm({
  serviceId,
  serviceName,
  pricePerUnit,
  minQuantity,
  maxQuantity,
  balance,
  linkPlaceholder,
}: OrderFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loading, setLoading] = React.useState(false);
  const [couponStatus, setCouponStatus] = React.useState<
    "idle" | "applied" | "invalid"
  >("idle");
  const [conflicts, setConflicts] = React.useState<UrlConflict[] | null>(null);
  const [pendingValues, setPendingValues] = React.useState<z.infer<typeof formSchema> | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { quantity: minQuantity, link: "", coupon: "" },
  });

  const quantity = form.watch("quantity") || 0;
  // pricePerUnit is per 1000 units, so the total is (price/1000) x quantity.
  const total = computeOrderCharge(pricePerUnit, quantity);

  async function placeOrder(values: z.infer<typeof formSchema>) {
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
        queryClient.invalidateQueries({ queryKey: ["profile-balance"] });
        router.push(`/orders/${result.data.orderId}`);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to place order");
      }
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      const check = await checkUrlConflictAction({ link: values.link, serviceId });
      const found = check.success ? (check.data?.conflicts ?? []) : [];
      if (found.length > 0) {
        setPendingValues(values);
        setConflicts(found);
        return;
      }
      await placeOrder(values);
    } finally {
      setLoading(false);
    }
  }

  const insufficient = total > balance;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-6"
    >
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
        <ShoppingCart className="h-5 w-5 text-primary" /> Place Order
      </h2>
      <p className="mb-5 line-clamp-1 text-xs text-muted-foreground">{serviceName}</p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Quantity ({minQuantity.toLocaleString()} - {maxQuantity.toLocaleString()})
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={minQuantity}
                    max={maxQuantity}
                    placeholder="1000"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="link"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Link</FormLabel>
                <FormControl>
                  <Input
                    placeholder={linkPlaceholder ?? "https://www.instagram.com/p/..."}
                    {...field}
                  />
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
                  <p className="text-xs text-success">Coupon applied!</p>
                ) : null}
                {couponStatus === "invalid" ? (
                  <p className="text-xs text-destructive">Invalid coupon</p>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="rounded-lg bg-muted/60 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Quantity</span>
              <span className="font-medium">{quantity.toLocaleString()}</span>
            </div>
            <div className="mt-1.5 flex justify-between text-sm">
              <span className="text-muted-foreground">Rate (per 1k)</span>
              <span>{formatUsd(pricePerUnit)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t pt-2">
              <span className="font-medium">Total</span>
              <span className="text-xl font-bold text-primary">
                {formatUsd(total)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Your balance</span>
              <span className={insufficient ? "font-semibold text-destructive" : "font-semibold text-success"}>
                {formatUsd(balance)}
              </span>
            </div>
          </div>

          {insufficient ? (
            <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              <span>
                Insufficient balance.{" "}
                <a href="/add-funds" className="font-semibold text-primary hover:underline">
                  Add funds
                </a>{" "}
                to continue.
              </span>
            </div>
          ) : null}

          <Button type="submit" variant="gradient" className="w-full" disabled={loading || insufficient}>
            {loading ? <Loader2 className="animate-spin" /> : <Zap />}
            {insufficient ? "Insufficient Balance" : "Place Order Now"}
          </Button>
        </form>
      </Form>

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
              disabled={loading || !pendingValues}
              onClick={() => pendingValues && placeOrder(pendingValues)}
            >
              {loading ? <Loader2 className="animate-spin" /> : null}
              Continue anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
