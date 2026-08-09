import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { OrderStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Wallet,
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Layers,
  TrendingUp,
} from "lucide-react";
import { formatCurrency, formatDateTime, truncate } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types/database";

export default async function DashboardPage() {
  const { user, error } = await requireUser();
  if (error || !user) return null;

  const supabase = await createClient();

  const { data: recentOrders } = await supabase
    .from("orders")
    .select("id, order_number, service_id, services(name), quantity, price, status, created_at, currency")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(8);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [ordersRes, todayOrdersRes, pendingRes, completedRes, cancelledRes, spendingRes] =
    await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", startOfToday),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("status", ["pending", "processing", "in_progress"]),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "completed"),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "cancelled"),
      supabase
        .from("transactions")
        .select("amount")
        .eq("user_id", user.id)
        .eq("type", "order_deduction"),
    ]);

  const totalSpent = (spendingRes.data ?? []).reduce(
    (sum, t) => sum + Math.abs(Number(t.amount)),
    0
  );

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user.full_name?.split(" ")[0] ?? "User"}`}
        description="Here's what's happening with your account today."
      >
        <Button asChild variant="gradient">
          <Link href="/services">
            <Layers /> New Order
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Balance" value={formatCurrency(user.balance, user.currency)} icon={Wallet} color="primary" description="Available balance" />
        <StatCard title="Today's Orders" value={todayOrdersRes.count ?? 0} icon={ShoppingBag} color="info" />
        <StatCard title="Pending" value={pendingRes.count ?? 0} icon={Clock} color="warning" />
        <StatCard title="Completed" value={completedRes.count ?? 0} icon={CheckCircle2} color="success" />
        <StatCard title="Cancelled" value={cancelledRes.count ?? 0} icon={XCircle} color="destructive" />
        <StatCard title="Total Spent" value={formatCurrency(totalSpent, user.currency)} icon={TrendingUp} color="info" />
      </div>

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Orders</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/orders">
              View all <ArrowRight />
            </Link>
          </Button>
        </div>

        {(recentOrders ?? []).length === 0 ? (
          <EmptyState
            title="No orders yet"
            description="Place your first order and watch your social media grow."
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
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Order</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Service</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Qty</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(recentOrders ?? []).map((order) => (
                      <tr key={order.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <Link href={`/orders/${order.id}`} className="font-medium text-primary hover:underline">
                            #{order.order_number}
                          </Link>
                        </td>
                        <td className="max-w-[220px] px-4 py-3">
                          <span className="line-clamp-1">{truncate(order.services?.name ?? "Service", 40)}</span>
                        </td>
                        <td className="px-4 py-3">{order.quantity.toLocaleString()}</td>
                        <td className="px-4 py-3 font-medium">{formatCurrency(order.price, order.currency)}</td>
                        <td className="px-4 py-3">
                          <OrderStatusBadge status={order.status as OrderStatus} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDateTime(order.created_at, "MMM d, h:mm a")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
