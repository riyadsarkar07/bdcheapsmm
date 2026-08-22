"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/empty-state";
import { OrderStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Layers } from "lucide-react";
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

  React.useEffect(() => {
    setOrders(initialOrders);
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
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Order #</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Service</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Price</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link href={`/orders/${order.id}`} className="font-semibold text-primary hover:underline">
                      #{order.order_number}
                    </Link>
                  </td>
                  <td className="max-w-[280px] px-4 py-3">
                    <span className="line-clamp-1">{truncate(order.services?.name ?? "Service", 50)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{order.quantity.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatUsd(order.price)}</td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(order.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
