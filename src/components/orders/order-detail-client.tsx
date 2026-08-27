"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OrderStatusBadge } from "@/components/status-badges";
import { CopyButton } from "@/components/copy-button";
import {
  cancelOrderAction,
  refreshOrderStatusAction,
  refillOrderAction,
  retryFailedOrderAction,
} from "@/lib/actions/orders";
import { formatUsd, formatDateTime } from "@/lib/utils";
import type { Order } from "@/lib/types/database";
import type { OrderStatus } from "@/lib/types/database";

interface OrderWithRelations extends Order {
  services?: { id: string; name: string; slug: string; type: string | null } | null;
}

export function OrderDetailClient({
  order,
  providerName,
  isAdmin = false,
}: {
  order: OrderWithRelations;
  providerName: string | null;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [orderState, setOrderState] = React.useState(order);
  const [action, setAction] = React.useState<string | null>(null);

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
              ? "Order cancelled & refunded"
              : name === "refill"
                ? "Refill requested"
                : "Order retried"
        );
        if (name === "refresh" && result.data) {
          const data = result.data as { status: OrderStatus; start_count: number | null; remain: number | null };
          setOrderState((prev) => ({
            ...prev,
            status: data.status,
            start_count: data.start_count,
            remain: data.remain,
          }));
        }
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

  const details = [
    { label: "Order Number", value: `#${orderState.order_number}`, copy: orderState.order_number },
    { label: "Service", value: orderState.services?.name ?? "—" },
    { label: "Quantity", value: orderState.quantity.toLocaleString() },
    { label: "Price", value: formatUsd(orderState.price) },
    { label: "Provider Order ID", value: orderState.provider_order_id ?? "—", copy: orderState.provider_order_id ?? undefined },
    { label: "Provider", value: providerName ?? "—" },
    { label: "Start Count", value: orderState.start_count?.toLocaleString() ?? "—" },
    { label: "Remaining", value: orderState.remain?.toLocaleString() ?? "—" },
    { label: "Refills", value: String(orderState.refill_count ?? 0) },
    { label: "Created", value: formatDateTime(orderState.created_at) },
    { label: "Updated", value: formatDateTime(orderState.updated_at) },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Order #{orderState.order_number}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{orderState.services?.name}</p>
        </div>
        <OrderStatusBadge status={orderState.status} />
      </div>

      {orderState.error_message ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-semibold text-destructive">Error</p>
          <p className="mt-1 text-muted-foreground">{orderState.error_message}</p>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-4 w-4" /> Order Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {details.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">{item.label}</dt>
                  <dd className="flex items-center gap-1 text-right text-sm font-medium">
                    <span className="max-w-[180px] truncate">{item.value}</span>
                    {item.copy ? <CopyButton value={item.copy} label={`Copy ${item.label}`} /> : null}
                  </dd>
                </div>
              ))}
            </dl>

            <Separator className="my-4" />

            <div className="flex flex-col gap-2">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Target Link
              </p>
              <div className="flex items-center gap-2 rounded-lg border p-3">
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm">{orderState.link}</span>
                <a
                  href={orderState.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <CopyButton value={orderState.link} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4" /> Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
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
              onClick={() => runAction("retry", () => retryFailedOrderAction(orderState.id))}
              disabled={action !== null || !canRetry}
            >
              {action === "retry" ? <Loader2 className="animate-spin" /> : <Zap />}
              Retry Order
            </Button>

            <Separator className="my-2" />

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Status updates every few minutes automatically.
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="subtle">Status: {orderState.status.replace("_", " ")}</Badge>
              {orderState.provider_order_id ? (
                <Badge variant="secondary">Submitted to provider</Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

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
