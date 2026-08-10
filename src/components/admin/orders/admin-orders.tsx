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
import {
  adminUpdateOrderStatusAction,
  adminRefundOrderAction,
  adminBulkRetryFailedOrdersAction,
} from "@/lib/actions/admin";
import {
  cancelOrderAction,
  refreshOrderStatusAction,
  refillOrderAction,
  retryFailedOrderAction,
} from "@/lib/actions/orders";
import { formatCurrency, formatDateTime, truncate } from "@/lib/utils";
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
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(order.price, order.currency)}</td>
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
                              onClick={() =>
                                runOrderAction(order, "Retry", () => retryFailedOrderAction(order.id))
                              }
                              disabled={actionLoading === order.id + "Retry"}
                              title="Retry order"
                            >
                              {actionLoading === order.id + "Retry" ? <Loader2 className="animate-spin" /> : <Zap />}
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
    </div>
  );
}
