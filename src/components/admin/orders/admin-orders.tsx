"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Loader2, RefreshCw, Undo2, RotateCcw, XCircle, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { OrderStatusBadge } from "@/components/status-badges";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  adminUpdateOrderStatusAction,
  adminRefundOrderAction,
  adminBulkRetryFailedOrdersAction,
} from "@/lib/actions/admin";
import {
  cancelOrderAction,
  refreshOrderStatusAction,
  refillOrderAction,
  retryOrderAction,
} from "@/lib/actions/orders";
import { formatUsd, formatDateTime, truncate } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types/database";

type OrderRow = {
  id: string;
  order_number: string;
  user_id: string;
  profiles?: { full_name: string | null; email: string | null } | null;
  services?: { name: string } | null;
  provider_id: string | null;
  provider_order_id: string | null;
  quantity: number;
  price: number;
  status: OrderStatus;
  created_at: string;
  currency: string;
};

const statusOptions: OrderStatus[] = [
  "pending",
  "processing",
  "in_progress",
  "completed",
  "partial",
  "cancelled",
  "refunded",
  "failed",
  "rejected",
];

export function AdminOrders({ orders }: { orders: OrderRow[] }) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [retrying, setRetrying] = React.useState(false);
  const [retryTarget, setRetryTarget] = React.useState<OrderRow | null>(null);
  const [retryLink, setRetryLink] = React.useState("");

  const filtered = orders.filter((order) => {
    const matchesSearch =
      order.order_number.toLowerCase().includes(search.toLowerCase()) ||
      (order.profiles?.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (order.profiles?.full_name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function setStatus(order: OrderRow, status: OrderStatus) {
    setActionLoading(order.id + status);
    try {
      const result = await adminUpdateOrderStatusAction(order.id, status);
      if (result.success) {
        toast.success(`Order #${order.order_number} → ${status}`);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed");
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function runOrderAction(order: OrderRow, name: string, fn: () => Promise<{ success: boolean; error?: string }>) {
    setActionLoading(order.id + name);
    try {
      const result = await fn();
      if (result.success) {
        toast.success(`Order #${order.order_number}: ${name}`);
        router.refresh();
      } else {
        toast.error(result.error ?? `${name} failed`);
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function refund(order: OrderRow) {
    setActionLoading(order.id + "refund");
    try {
      const result = await adminRefundOrderAction(order.id);
      if (result.success) {
        toast.success(result.message ?? "Order refunded");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed");
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function bulkRetry() {
    setRetrying(true);
    try {
      const result = await adminBulkRetryFailedOrdersAction();
      if (result.success) {
        toast.success(result.message ?? "Retried");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed");
      }
    } finally {
      setRetrying(false);
    }
  }

  async function submitRetry(e: React.FormEvent) {
    e.preventDefault();
    if (!retryTarget || actionLoading === retryTarget.id + "Retry") return;
    setActionLoading(retryTarget.id + "Retry");
    try {
      const result = await retryOrderAction(retryTarget.id, retryLink);
      if (result.success) {
        toast.success(`Order #${retryTarget.order_number}: new order created`);
        setRetryTarget(null);
        setRetryLink("");
        router.refresh();
      } else {
        toast.error(result.error ?? "Retry failed");
      }
    } finally {
      setActionLoading(null);
    }
  }

  const canCancel = (status: OrderStatus) => ["pending", "processing", "in_progress"].includes(status);
  const canRefill = (status: OrderStatus) => status === "completed" || status === "partial";
  const canRetry = (status: OrderStatus) => status === "failed" || status === "rejected";

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search order #, email or name..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={bulkRetry} disabled={retrying} title="Retry all failed orders">
            {retrying ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No orders found" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Order</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Service</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order) => (
                    <tr key={order.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link href={`/orders/${order.id}`} className="font-medium text-primary hover:underline">
                          #{order.order_number}
                        </Link>
                        {order.provider_order_id ? (
                          <p className="text-[11px] text-muted-foreground">PID: {order.provider_order_id}</p>
                        ) : null}
                      </td>
                      <td className="max-w-[160px] px-4 py-3">
                        <span className="line-clamp-1">{order.profiles?.full_name ?? order.profiles?.email ?? "—"}</span>
                      </td>
                      <td className="max-w-[200px] px-4 py-3">
                        <span className="line-clamp-1">{truncate(order.services?.name ?? "—", 30)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">{order.quantity.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatUsd(order.price)}</td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(order.created_at, "MMM d, h:mm a")}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Select value={order.status} onValueChange={(v) => setStatus(order, v as OrderStatus)}>
                            <SelectTrigger className="h-8 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map((s) => (
                                <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {order.provider_order_id ? (
                            <Button
                              variant="ghost"
                              size="iconSm"
                              className="text-primary hover:text-primary"
                              onClick={() =>
                                runOrderAction(order, "Check Status", () => refreshOrderStatusAction(order.id))
                              }
                              disabled={actionLoading === order.id + "Check Status"}
                              title="Check status with provider (SMMFollow)"
                            >
                              {actionLoading === order.id + "Check Status" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                            </Button>
                          ) : null}
                          {canRefill(order.status) ? (
                            <Button
                              variant="ghost"
                              size="iconSm"
                              className="text-warning hover:text-warning"
                              onClick={() =>
                                runOrderAction(order, "Refill", () => refillOrderAction(order.id))
                              }
                              disabled={actionLoading === order.id + "Refill"}
                              title="Request refill"
                            >
                              {actionLoading === order.id + "Refill" ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                            </Button>
                          ) : null}
                          {canRetry(order.status) ? (
                            <Button
                              variant="ghost"
                              size="iconSm"
                              className="text-primary hover:text-primary"
                              onClick={() => {
                                setRetryLink("");
                                setRetryTarget(order);
                              }}
                              disabled={actionLoading === order.id + "Retry"}
                              title="Retry order with a new link"
                            >
                              <Zap />
                            </Button>
                          ) : null}
                          {canCancel(order.status) ? (
                            <Button
                              variant="ghost"
                              size="iconSm"
                              className="text-destructive hover:text-destructive"
                              onClick={() =>
                                runOrderAction(order, "Cancel", () => cancelOrderAction(order.id))
                              }
                              disabled={actionLoading === order.id + "Cancel"}
                              title="Cancel order"
                            >
                              {actionLoading === order.id + "Cancel" ? <Loader2 className="animate-spin" /> : <XCircle />}
                            </Button>
                          ) : null}
                          {order.status !== "refunded" ? (
                            <Button
                              variant="ghost"
                              size="iconSm"
                              className="text-success hover:text-success"
                              onClick={() => refund(order)}
                              disabled={actionLoading === order.id + "refund"}
                              title="Refund"
                            >
                              {actionLoading === order.id + "refund" ? <Loader2 className="animate-spin" /> : <Undo2 />}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={retryTarget !== null} onOpenChange={(open) => !open && setRetryTarget(null)}>
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
          {retryTarget ? (
            <form onSubmit={submitRetry} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Order Number</p>
                  <p className="font-medium">#{retryTarget.order_number}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Quantity</p>
                  <p className="font-medium">{retryTarget.quantity.toLocaleString()}</p>
                </div>
                <div className="col-span-2 rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Service</p>
                  <p className="line-clamp-1 font-medium">{retryTarget.services?.name ?? "—"}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">User</p>
                  <p className="line-clamp-1 font-medium">
                    {retryTarget.profiles?.full_name ?? retryTarget.profiles?.email ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="font-medium">{formatUsd(retryTarget.price)}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-retry-link">New Target Link</Label>
                <Input
                  id="admin-retry-link"
                  type="url"
                  value={retryLink}
                  onChange={(e) => setRetryLink(e.target.value)}
                  placeholder="https://..."
                  autoFocus
                  required
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRetryTarget(null)}
                  disabled={actionLoading === retryTarget.id + "Retry"}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading === retryTarget.id + "Retry"}
                >
                  {actionLoading === retryTarget.id + "Retry" ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Zap />
                  )}
                  Create New Order
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
