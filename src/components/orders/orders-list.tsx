"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/empty-state";
import { OrderStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Layers, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { formatUsd, formatDateTime, truncate } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types/database";

type OrderRow = {
  id: string;
  order_number: string;
  service_id: string | null;
  services?: { name: string } | null;
  quantity: number;
  price: number;
  status: OrderStatus;
  created_at: string;
  currency: string;
};

const PAGE_SIZE = 15;

export function OrdersList({
  initialOrders,
  userId,
  statusFilter,
}: {
  initialOrders: OrderRow[];
  userId: string;
  statusFilter?: string;
}) {
  const supabase = createClient();
  const [orders, setOrders] = React.useState<OrderRow[]>(initialOrders);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState(statusFilter ?? "all");
  const [page, setPage] = React.useState(0);

  React.useEffect(() => {
    setOrders(initialOrders);
    setPage(0);
  }, [initialOrders]);

  React.useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function refresh() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        if (!mounted) return;
        let query = supabase
          .from("orders")
          .select("id, order_number, service_id, services(name), quantity, price, status, created_at, currency")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (statusFilter && statusFilter !== "all") {
          query = query.eq("status", statusFilter as OrderStatus);
        }
        const { data } = await query.limit(100);
        if (mounted && data) {
          setOrders(data as OrderRow[]);
        }
      }, 400);
    }

    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${userId}` },
        refresh
      )
      .subscribe();

    // Polling fallback so status changes still surface when realtime events are
    // not delivered. Reuses the same debounced refresh (no duplicate logic).
    const poll = setInterval(refresh, 30_000);

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, statusFilter]);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = status === "all" || order.status === status;
      const matchesSearch =
        !term ||
        order.order_number.toLowerCase().includes(term) ||
        (order.services?.name ?? "").toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [orders, search, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  if (orders.length === 0) {
    return (
      <EmptyState
        title="No orders found"
        description="Place your first order and it will show up here."
        action={
          <Button asChild variant="gradient">
            <Link href="/services">
              <Layers /> Browse Services
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by order # or service..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            aria-label="Search orders"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No matching orders"
          description="Try a different search term or status filter."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Order #</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Service</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Price</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((order) => (
                    <tr key={order.id} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link href={`/orders/${order.id}`} className="font-semibold text-primary hover:underline">
                          #{order.order_number}
                        </Link>
                      </td>
                      <td className="max-w-[280px] px-4 py-3">
                        <span className="line-clamp-1">{truncate(order.services?.name ?? "Service", 50)}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{order.quantity.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{formatUsd(order.price)}</td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {formatDateTime(order.created_at, "MMM d, h:mm a")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y md:hidden">
              {visible.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/orders/${order.id}`}
                    className="block px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-primary">#{order.order_number}</span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm">{truncate(order.services?.name ?? "Service", 60)}</p>
                    <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="tabular-nums">
                        {order.quantity.toLocaleString()} units · {formatUsd(order.price)}
                      </span>
                      <span>{formatDateTime(order.created_at, "MMM d, h:mm a")}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {filtered.length > PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Page {safePage + 1} of {pageCount} · {filtered.length} orders
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
            >
              <ChevronLeft /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
            >
              Next <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
