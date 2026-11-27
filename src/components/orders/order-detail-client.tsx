"use client";

import { CustomerText, useCustomerText } from "@/components/customer-language";
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
import {dhakaTime,refillDeadline} from "@/lib/customer-order";
import {CopyOrderDetails} from "@/components/orders/copy-order-details";
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
  refillLabel,
  refillDisabled,
  providerName,
  isAdmin = false,
  isOwner,
  profit,
}: {
  order: OrderWithRelations;
  refillLabel: string;
  refillDisabled: boolean;
  providerName: string | null;
  isAdmin?: boolean;
  isOwner: boolean;
  profit?: OrderProfit;
}) {
  const t = useCustomerText();
  const router = useRouter();
  const reduced = useReducedMotion();
  const orderState = order;
  const snapshot = order.provider_response;
  const providerStatus = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) && typeof snapshot.status === "string" ? snapshot.status : null;
  const checkedAt = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) && typeof snapshot.panel_checked_at === "string" ? snapshot.panel_checked_at : null;
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
      const attemptKey="retry:"+orderState.id+":"+retryLink;
      const requestId=sessionStorage.getItem(attemptKey)||crypto.randomUUID();
      sessionStorage.setItem(attemptKey,requestId);
      const result=await retryOrderAction(orderState.id,retryLink,requestId);
      if (result.success && result.data) {
        sessionStorage.removeItem(attemptKey);
        toast.success(t("Order recorded"));
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
  const deadline=refillDeadline(snapshot);
  const expired=!!deadline && Date.parse(deadline)<Date.now();
  const reviewing=!!order.refill_claimed_at||["submitted","pending","processing","in progress","in_progress"].includes(String(order.provider_refill_status).toLowerCase())||!order.provider_refill_status&&snapshot && typeof snapshot==="object" && !Array.isArray(snapshot) && ["pending","processing","in progress"].includes(String(snapshot.refill_status).toLowerCase());
  const reason=!canRefill?"Refill opens after delivery":expired?"Refill window ended":reviewing?"A refill is under review":!order.provider_order_id?"Awaiting provider order ID":(order.refill_count??0)>=2?"Refill limit reached":refillDisabled?"No automatic refill":null;
  const delivered = order.remain == null || order.quantity <= 0 ? null : Math.min(order.quantity, Math.max(0, order.quantity - order.remain));
  const progress = delivered == null ? null : Math.round(100 * delivered / order.quantity);

  const details = [
    { label: "Order Number", value: `#${orderState.order_number}`, copy: orderState.order_number },
    { label: "Provider Order ID", value: orderState.provider_order_id ?? "—", copy: orderState.provider_order_id ?? undefined },
    { label: "Quantity", value: orderState.quantity.toLocaleString() },
    { label: "Price", value: formatCurrency(orderState.price, orderState.currency) },
    { label: "Provider status", value: providerStatus || "Not reported yet" },
    { label: "Provider", value: providerName ?? "—" },
    { label: "Start Count", value: orderState.start_count?.toLocaleString() ?? "—" },
    { label: "Remaining", value: orderState.remain?.toLocaleString() ?? "—" },
    { label: "Refills", value: String(orderState.refill_count ?? 0) },
    { label: "Created", value: dhakaTime(orderState.created_at) },
    { label: "Updated", value: dhakaTime(orderState.updated_at) },
  ];

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-w-0 max-w-full space-y-5 [overflow-wrap:anywhere]"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow mb-1"><CustomerText value="Order details" /></p>
          <h1 className="break-words text-xl font-bold sm:text-2xl">{orderState.services?.name ?? t("Order details")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("Last provider check")} · {checkedAt ? dhakaTime(checkedAt) : t("Not checked yet")}</p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <OrderStatusBadge providerStatus={providerStatus || (order.provider_order_id ? "Awaiting provider status" : null)} status={orderState.status} />
          {order.provider_order_id && <Button size="icon" variant="ghost" aria-label={t("Refresh Status")} title={t("Refresh Status")}
            disabled={action !== null} onClick={() => runAction("refresh", () => refreshOrderStatusAction(order.id))}>
            {action === "refresh" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          </Button>}
          <Badge variant="secondary">{formatCurrency(orderState.price, orderState.currency)}</Badge>
        </div>
      </div>

      {orderState.error_message ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-semibold text-destructive">Error</p>
          <p className="mt-1 text-muted-foreground">{orderState.error_message}</p>
        </div>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-primary" /> <CustomerText value="Delivery progress" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <p className="font-semibold">{delivered == null ? t("Awaiting delivery count") : t(`${delivered} of ${order.quantity} delivered`)}</p>
                {progress != null && <span className="text-sm font-semibold text-primary">{progress}%</span>}
              </div>
              {progress != null && <Progress value={progress} className="h-2.5" />}
              {orderState.status === "completed" ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> <CustomerText value="Delivery complete" />
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base">
                <Hash className="h-4 w-4 text-primary" /> <CustomerText value="Order Details" />
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
              <dl className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                {details.map((item) => (
                  <div key={item.label} className="grid min-w-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                    <dt className="text-sm text-foreground/80"><CustomerText value={item.label} /></dt>
                    <dd className="flex min-w-0 items-center justify-end gap-1 text-right text-sm font-medium">
                      <span className="min-w-0 [overflow-wrap:anywhere]">{item.value}</span>
                      {item.copy && <CopyButton className="shrink-0" value={item.copy} label={`Copy ${item.label}`} />}
                    </dd>
                  </div>
                ))}
              </dl>

              <Separator className="my-4" />

              <div className="flex flex-col gap-2">
                <p className="eyebrow"><CustomerText value="Target link" /></p>
                <div className="flex items-center gap-2 rounded-lg border p-3">
                  <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">{orderState.link}</span>
                  <a
                    href={orderState.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
                    aria-label="Open target link in a new tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <CopyButton className="shrink-0" value={orderState.link} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card id="order-actions" className="scroll-mt-24 h-fit min-w-0 lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-primary" /> <CustomerText value="Actions" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <CopyOrderDetails number={order.order_number} provider={order.provider_order_id} service={order.checkout_terms && typeof order.checkout_terms==="object" && !Array.isArray(order.checkout_terms) && typeof order.checkout_terms.service==="string" ? order.checkout_terms.service : order.services?.name||t("Service")} quantity={order.quantity} status={providerStatus||t(order.status)}/>
            {isOwner && <>
              {canRefill && <Button asChild variant="outline" className="w-full"><Link href={`/support/new?order=${order.id}&drop=1`}>{t("Report follower drop")}</Link></Button>}
              {order.service_id && !canCancel && <Button asChild variant="gradient" className="w-full"><Link href={`/services/${order.service_id}?repeat=${order.id}`}>{t("Order again")}</Link></Button>}
              <Button asChild variant={canCancel ? "gradient" : "outline"} className="w-full"><Link href={`/support/new?order=${order.id}`}>{t("Get order support")}</Link></Button>
            </>}
            {canRefill && !expired && !reviewing && (!refillDisabled || isAdmin) && order.provider_order_id && (order.refill_count ?? 0) < 2 && <Button
              variant="outline" className="w-full" disabled={action !== null} onClick={() => runAction("refill", () => refillOrderAction(order.id, isAdmin && refillDisabled))}>
              <RotateCcw />{t("Request refill")}
            </Button>}
            {reason&&<p className="text-xs">{t(reason)}</p>}
            {canRefill&&<p>{deadline?t("Refill deadline")+" · "+dhakaTime(deadline):t("Provider has not confirmed a refill deadline")}</p>}
            {order.status==="partial"&&<p>{t("Partially delivered. Check the remaining count and refund history.")}</p>}
            {canRefill && <p className="text-xs text-muted-foreground">{t("Refill:")} {t(refillLabel)}</p>}
            {canRetry && <Button variant="outline" className="w-full" disabled={action !== null} onClick={() => setRetryOpen(true)}><Zap />{t("Retry Order")}</Button>}
            <details className="rounded-lg border px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">{t("More options")}</summary>
              <div className="mt-2 grid gap-2">
                <Button asChild variant="ghost"><a href={`/api/orders/${order.id}/invoice`} download={`invoice-${order.order_number}.pdf`}><FileDown />{t("Download Invoice")}</a></Button>
                {isOwner && canCancel && order.service_id && <Button asChild variant="ghost"><Link href={`/services/${order.service_id}?repeat=${order.id}`}>{t("Order again")}</Link></Button>}
                {canCancel && order.provider_order_id && <Button variant="outline" className="text-destructive" disabled={action !== null || (order.cancel_count ?? 0) > 0}
                  onClick={() => runAction("cancel", () => cancelOrderAction(order.id))}><XCircle />{t("Cancel Order")}</Button>}
              </div>
            </details>
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
              <CustomerText value="Retry Order" />
            </DialogTitle>
            <DialogDescription>
              Create a brand-new order with the same service and quantity, but a
              different target link. The original failed order is left unchanged.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRetry} className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground"><CustomerText value="Order Number" /></p>
                <p className="font-medium">#{orderState.order_number}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground"><CustomerText value="Quantity" /></p>
                <p className="font-medium">{orderState.quantity.toLocaleString()}</p>
              </div>
              <div className="col-span-2 rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground"><CustomerText value="Service" /></p>
                <p className="line-clamp-1 font-medium">{orderState.services?.name ?? "—"}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground"><CustomerText value="Price" /></p>
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
                <CustomerText value="Cancel" />
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
        <Link href="/orders"><CustomerText value="View all orders" /></Link>
      </Button>
    </motion.div>
  );
}
