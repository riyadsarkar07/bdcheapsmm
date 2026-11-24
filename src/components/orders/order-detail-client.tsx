"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, useReducedMotion } from "framer-motion";
import {
  RefreshCw,
  XCircle,
  RotateCcw,
  Zap,
  ExternalLink,
  Loader2,
  Link2,
  Layers,
  Hash,
  Clock,
  FileDown,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OrderStatusBadge } from "@/components/status-badges";
import { CopyButton } from "@/components/copy-button";
import {
  cancelOrderAction,
  refreshOrderStatusAction,
  refillOrderAction,
  retryOrderAction,
} from "@/lib/actions/orders";
import { formatCurrency, formatUsd, formatDateTime } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Order } from "@/lib/types/database";
import type { OrderProfit } from "@/lib/order-profit";

interface OrderWithRelations extends Order {
  services?: { id: string; name: string; slug: string; type: string | null } | null;
}

function ProfitValue({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">N/A</span>;
  return (
    <span className={value < 0 ? "text-destructive" : value > 0 ? "text-success" : "text-foreground"}>
      {formatUsd(value, 4)}
    </span>
  );
}

export function OrderDetailClient({
  order,
  providerName,
  isAdmin = false,
  isOwner,
  profit,
}: {
  order: OrderWithRelations;
  providerName: string | null;
  isAdmin?: boolean;
  isOwner: boolean;
  profit?: OrderProfit;
}) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const orderState = order;
  const snapshot = order.provider_response;
  const providerStatus = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) && typeof snapshot.status === "string" ? snapshot.status : null;
  React.useEffect(() => {
    const db = createClient();
    const channel = db.channel(`order-detail-${order.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${order.id}` }, () => router.refresh())
      .subscribe();
    return () => { void db.removeChannel(channel); };
  }, [order.id, router]);
  const [action, setAction] = React.useState<string | null>(null);
  const [retryOpen, setRetryOpen] = React.useState(false);
  const [retryLink, setRetryLink] = React.useState(order.link);

  async function handleRetry(e: React.FormEvent) {
    e.preventDefault();
    if (action !== null) return;
    setAction("retry");
    try {
      const result = await retryOrderAction(orderState.id, retryLink);
      if (result.success && result.data) {
        toast.success("New order created — retry submitted");
        setRetryOpen(false);
        router.refresh();
        router.push(`/orders/${result.data.orderId}`);
      } else {
        toast.error(result.error ?? "Retry failed");
      }
    } finally {
      setAction(null);
    }
  }

  async function runAction(
    name: string,
    fn: () => Promise<{ success: boolean; error?: string; data?: unknown }>
  ) {
    setAction(name);
    try {
      const result = await fn();
      if (result.success) {
        toast.success(
          name === "refresh"
            ? "Status refreshed"
            : name === "cancel"
              ? "Cancellation requested. Awaiting provider confirmation."
              : name === "refill"
                ? "Refill requested"
                : "Order retried"
        );
        router.refresh();
      } else {
        toast.error(result.error ?? "Action failed");
      }
    } finally {
      setAction(null);
    }
  }

  const canCancel = ["pending", "processing", "in_progress"].includes(orderState.status);
  const canRefill = orderState.status === "completed" || orderState.status === "partial";
  const canRetry = orderState.status === "failed" || orderState.status === "rejected";
  const delivered = order.remain == null || order.quantity <= 0 ? null : Math.min(order.quantity, Math.max(0, order.quantity - order.remain));
  const progress = delivered == null ? null : Math.round(100 * delivered / order.quantity);

  const details = [
    { label: "Order Number", value: `#${orderState.order_number}`, copy: orderState.order_number },
    { label: "Service", value: orderState.services?.name ?? "—" },
    { label: "Quantity", value: orderState.quantity.toLocaleString() },
    { label: "Price", value: formatCurrency(orderState.price, orderState.currency) },
    { label: "Provider Order ID", value: orderState.provider_order_id ?? "—", copy: orderState.provider_order_id ?? undefined },
    { label: "Provider status", value: providerStatus || "Not reported yet" },
    { label: "Provider", value: providerName ?? "—" },
    { label: "Start Count", value: orderState.start_count?.toLocaleString() ?? "—" },
    { label: "Remaining", value: orderState.remain?.toLocaleString() ?? "—" },
    { label: "Refills", value: String(orderState.refill_count ?? 0) },
    { label: "Created", value: formatDateTime(orderState.created_at) },
    { label: "Updated", value: formatDateTime(orderState.updated_at) },
  ];

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow mb-1">Order details</p>
          <h1 className="truncate text-2xl font-bold">Order #{orderState.order_number}</h1>
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{orderState.services?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusBadge providerStatus={providerStatus || (order.provider_order_id ? "Awaiting provider status" : null)} status={orderState.status} />
          <Badge variant="secondary">{formatCurrency(orderState.price, orderState.currency)}</Badge>
        </div>
      </div>

      {orderState.error_message ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-semibold text-destructive">Error</p>
          <p className="mt-1 text-muted-foreground">{orderState.error_message}</p>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-primary" /> Delivery progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-2 flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold tabular-nums">{progress == null ? "Awaiting delivery count" : `${progress}%`}</p>
                  <p className="text-xs text-muted-foreground">
                    {delivered != null && `${delivered.toLocaleString()} of ${orderState.quantity.toLocaleString()} delivered`}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {orderState.remain != null ? (
                    <>
                      <p className="font-semibold text-foreground tabular-nums">
                        {orderState.remain.toLocaleString()}
                      </p>
                      <p>remaining</p>
                    </>
                  ) : (
                    <p>Progress pending</p>
                  )}
                </div>
              </div>
              {progress != null && <Progress value={progress} className="h-2.5" />}
              {orderState.status === "completed" ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Delivery complete
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Hash className="h-4 w-4 text-primary" /> Order Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {details.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
                    <dt className="text-xs text-muted-foreground">{item.label}</dt>
                    <dd className="flex min-w-0 items-center gap-1 text-right text-sm font-medium">
                      <span className="max-w-[180px] truncate">{item.value}</span>
                      {item.copy ? <CopyButton value={item.copy} label={`Copy ${item.label}`} /> : null}
                    </dd>
                  </div>
                ))}
              </dl>

              <Separator className="my-4" />

              <div className="flex flex-col gap-2">
                <p className="eyebrow">Target link</p>
                <div className="flex items-center gap-2 rounded-lg border p-3">
                  <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{orderState.link}</span>
                  <a
                    href={orderState.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground transition-colors hover:text-primary"
                    aria-label="Open target link in a new tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <CopyButton value={orderState.link} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-primary" /> Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {isOwner && (
              <>
                <Button asChild variant="outline"><Link href={`/support/new?order=${orderState.id}`}>Get order support</Link></Button>
                {orderState.service_id && <Button asChild variant="gradient"><Link href={`/services/${orderState.service_id}?repeat=${orderState.id}`}>Order again</Link></Button>}
              </>
            )}
            <Button asChild variant="gradient" className="w-full justify-start">
              <a href={`/api/orders/${orderState.id}/invoice`} download={`invoice-${orderState.order_number}.pdf`}>
                <FileDown />
                Download Invoice
              </a>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => runAction("refresh", () => refreshOrderStatusAction(orderState.id))}
              disabled={action !== null}
            >
              {action === "refresh" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Refresh Status
            </Button>
            <Button
              variant="warning"
              className="w-full justify-start"
              onClick={() => runAction("refill", () => refillOrderAction(orderState.id))}
              disabled={action !== null || !canRefill}
            >
              {action === "refill" ? <Loader2 className="animate-spin" /> : <RotateCcw />}
              Request Refill
            </Button>
            <Button
              variant="destructive"
              className="w-full justify-start"
              onClick={() => runAction("cancel", () => cancelOrderAction(orderState.id))}
              disabled={action !== null || !canCancel}
            >
              {action === "cancel" ? <Loader2 className="animate-spin" /> : <XCircle />}
              Cancel Order
            </Button>
            <Button
              variant="success"
              className="w-full justify-start"
              onClick={() => setRetryOpen(true)}
              disabled={action !== null || !canRetry}
            >
              <Zap />
              Retry Order
            </Button>

            <Separator className="my-2" />

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Status updates every few minutes automatically.
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="subtle">Panel status: {orderState.status.replace("_", " ")}</Badge>
              {orderState.provider_order_id ? (
                <Badge variant="secondary">Submitted to provider</Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      {isAdmin && profit ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" /> Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
                <dt className="text-xs text-muted-foreground">User Price</dt>
                <dd className="text-right text-sm font-medium">{formatCurrency(orderState.price, orderState.currency)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
                <dt className="text-xs text-muted-foreground">Provider Cost</dt>
                <dd className="text-right text-sm font-medium">
                  {profit.providerCost == null ? <span className="text-muted-foreground">N/A</span> : formatUsd(profit.providerCost, 4)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
                <dt className="text-xs text-muted-foreground">Profit/Loss</dt>
                <dd className="text-right text-sm font-medium">
                  <ProfitValue value={profit.profit} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
                <dt className="text-xs text-muted-foreground">Margin %</dt>
                <dd className="text-right text-sm font-medium">
                  {profit.profitPercent == null ? (
                    <span className="text-muted-foreground">N/A</span>
                  ) : (
                    `${profit.profitPercent}%`
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={retryOpen} onOpenChange={setRetryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Retry Order
            </DialogTitle>
            <DialogDescription>
              Create a brand-new order with the same service and quantity, but a
              different target link. The original failed order is left unchanged.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRetry} className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Order Number</p>
                <p className="font-medium">#{orderState.order_number}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Quantity</p>
                <p className="font-medium">{orderState.quantity.toLocaleString()}</p>
              </div>
              <div className="col-span-2 rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Service</p>
                <p className="line-clamp-1 font-medium">{orderState.services?.name ?? "—"}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Price</p>
                <p className="font-medium">{formatCurrency(orderState.price, orderState.currency)}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="font-medium capitalize">{orderState.status.replace("_", " ")}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="retry-link">New Target Link</Label>
              <Input
                id="retry-link"
                type="url"
                value={retryLink}
                onChange={(e) => setRetryLink(e.target.value)}
                placeholder="https://..."
                autoFocus
                required
              />
              <p className="text-xs text-muted-foreground">
                The new order will be charged normally from your balance.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRetryOpen(false)}
                disabled={action === "retry"}
              >
                Cancel
              </Button>
              <Button type="submit" variant="success" disabled={action === "retry"}>
                {action === "retry" ? <Loader2 className="animate-spin" /> : <Zap />}
                Create New Order
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {isAdmin && orderState.provider_response ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Provider Response</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-lg bg-muted/50 p-4 text-xs">
              {JSON.stringify(orderState.provider_response, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}

      <Button asChild variant="link" className="-ml-2">
        <Link href="/orders">View all orders</Link>
      </Button>
    </motion.div>
  );
}
