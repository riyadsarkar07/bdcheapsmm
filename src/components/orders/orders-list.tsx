"use client";

import { CustomerText } from "@/components/customer-language";
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
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency, formatDateTime, truncate } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types/database";

type OrderRow = {
  id: string;
  order_number: string;
  provider_order_id: string | null;
  provider_status: string | null;
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
  initialTotal,
  userId,
  statusFilter,
}: {
  initialOrders: OrderRow[];
  initialTotal: number;
  userId: string;
  statusFilter?: string;
}) {
  const supabase = createClient();
  const [visible, setOrders] = React.useState(initialOrders);
  const [total, setTotal] = React.useState(initialTotal);
  const [error, setError] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState(statusFilter ?? "all");
  const [page, setPage] = React.useState(0);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);

  React.useEffect(() => {
    let active = true;
    let revision = 0;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      const version = ++revision;
      let query = supabase.from("orders")
        .select("id, order_number, provider_order_id, provider_status:provider_response->>status, service_id, services(name), matching:services(), quantity, price, status, created_at, currency", { count: "exact" })
        .eq("user_id", userId);
      if (status !== "all") query = query.eq("status", status as OrderStatus);
      const term = search.trim().replace(/^#/, "");
      if (term) {
        const pattern = "%" + term.replace(/[\\%_]/g, "\\$&") + "%";
        const quotedPattern = JSON.stringify(pattern);
        query = query.ilike("matching.name", pattern)
          .or(`order_number.ilike.${quotedPattern},provider_order_id.ilike.${quotedPattern},matching.not.is.null`);
      }
      const result = await query.order("created_at", { ascending: false })
        .order("id").range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (!active || revision !== version) return;
      if (result.error?.code === "PGRST103" && page > 0) { setPage(0); return; }
      if (result.error) { setError("Could not load orders. Please try again."); return; }
      setError("");
      setOrders(result.data ?? []);
      setTotal(result.count ?? 0);
      setPage(p => Math.min(p, Math.max(0, Math.ceil((result.count ?? 0) / PAGE_SIZE) - 1)));
    }
    function schedule() { clearTimeout(timer); timer = setTimeout(refresh, 300); }
    schedule();
    const channel = supabase.channel("orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${userId}` }, schedule)
      .subscribe();
    const poll = setInterval(schedule, 30_000);
    return () => { active = false; clearTimeout(timer); clearInterval(poll); void supabase.removeChannel(channel); };
  }, [supabase, userId, status, search, page]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search order #, provider ID or service"
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
            <SelectItem value="pending"><CustomerText value="Pending" /></SelectItem>
            <SelectItem value="processing"><CustomerText value="Processing" /></SelectItem>
            <SelectItem value="in_progress"><CustomerText value="In Progress" /></SelectItem>
            <SelectItem value="completed"><CustomerText value="Completed" /></SelectItem>
            <SelectItem value="partial"><CustomerText value="Partial" /></SelectItem>
            <SelectItem value="cancelled"><CustomerText value="Cancelled" /></SelectItem>
            <SelectItem value="refunded"><CustomerText value="Refunded" /></SelectItem>
            <SelectItem value="rejected"><CustomerText value="Rejected" /></SelectItem>
            <SelectItem value="failed"><CustomerText value="Failed" /></SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? <p role="alert">{error}</p> : visible.length === 0 ? (
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
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground"><CustomerText value="Service" /></th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground"><CustomerText value="Price" /></th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground"><CustomerText value="Date" /></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((order) => (
                    <tr key={order.id} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link href={`/orders/${order.id}`} className="font-semibold text-primary hover:underline">
                          #{order.order_number}
                        </Link>
                        {order.provider_order_id && (
                          <p className="break-all text-xs text-muted-foreground">Provider Order ID: {order.provider_order_id}</p>
                        )}
                      </td>
                      <td className="max-w-[280px] px-4 py-3">
                        <span className="line-clamp-1">{truncate(order.services?.name ?? "Service", 50)}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{order.quantity.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{formatCurrency(order.price, order.currency)}</td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge providerStatus={order.provider_status || (order.provider_order_id ? "Awaiting provider status" : null)} status={order.status} />
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
                      <OrderStatusBadge providerStatus={order.provider_status || (order.provider_order_id ? "Awaiting provider status" : null)} status={order.status} />
                    </div>
                    {order.provider_order_id && (
                      <p className="break-all text-xs text-muted-foreground">Provider Order ID: {order.provider_order_id}</p>
                    )}
                    <p className="mt-1 line-clamp-1 text-sm">{truncate(order.services?.name ?? "Service", 60)}</p>
                    <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="tabular-nums">
                        {order.quantity.toLocaleString()} units · {formatCurrency(order.price, order.currency)}
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

      {total > PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Page {safePage + 1} of {pageCount} · {total} orders
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
            >
              <ChevronLeft /> <CustomerText value="Prev" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
            >
              <CustomerText value="Next" /> <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
