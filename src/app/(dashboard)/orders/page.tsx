import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { OrderStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Layers } from "lucide-react";
import { formatUsd, formatDateTime, truncate } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types/database";

export const revalidate = 0;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const { user, error } = await requireUser();
  if (error || !user) return null;

  const supabase = await createClient();
  const baseQuery = supabase
    .from("orders")
    .select("id, order_number, service_id, services(name), quantity, price, status, created_at, currency")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const query =
    status && status !== "all"
      ? baseQuery.eq("status", status as OrderStatus)
      : baseQuery;

  const { data: orders } = await query.limit(100);

  return (
    <div>
      <PageHeader
        title="My Orders"
        description="Track and manage all your orders."
      >
        <Button asChild variant="gradient">
          <Link href="/services">
            <Plus /> New Order
          </Link>
        </Button>
      </PageHeader>

      <Tabs defaultValue={status ?? "all"} className="mb-5">
        <TabsList className="flex-wrap h-auto">
          {[
            { key: "all", label: "All" },
            { key: "pending", label: "Pending" },
            { key: "processing", label: "Processing" },
            { key: "in_progress", label: "In Progress" },
            { key: "completed", label: "Completed" },
            { key: "cancelled", label: "Cancelled" },
          ].map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} asChild>
              <Link href={`/orders?status=${tab.key}`}>{tab.label}</Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {(orders ?? []).length === 0 ? (
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
      ) : (
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
                  {(orders ?? []).map((order) => (
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
                        <OrderStatusBadge status={order.status as OrderStatus} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(order.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
