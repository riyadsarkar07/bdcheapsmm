import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { OrderStatusBadge } from "@/components/status-badges";
import { AnimatedNumber } from "@/components/animated-number";
import { MiniAreaChart, type ChartPoint } from "@/components/dashboard/mini-area-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Wallet,
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Layers,
  TrendingUp,
  ArrowDownToLine,
  Lightbulb,
  Headphones,
} from "lucide-react";
import { formatCurrency, formatUsd, formatDateTime, truncate } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types/database";

export const revalidate = 0;

const quickActions = [
  {
    href: "/services",
    label: "New Order",
    description: "Browse all services",
    icon: Layers,
  },
  {
    href: "/add-funds",
    label: "Add Funds",
    description: "Top up your wallet",
    icon: ArrowDownToLine,
  },
  {
    href: "/advisor",
    label: "Service Advisor",
    description: "Get a recommendation",
    icon: Lightbulb,
  },
  {
    href: "/support",
    label: "Support",
    description: "We are here to help",
    icon: Headphones,
  },
];

export default async function DashboardPage() {
  const { user, error } = await requireUser();
  if (error || !user) return null;

  const supabase = await createClient();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const sevenDaysAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 6
  ).toISOString();

  const [
    ordersRes,
    todayOrdersRes,
    pendingRes,
    completedRes,
    cancelledRes,
    spendingRes,
    recentOrdersRes,
    weekSpendingRes,
  ] = await Promise.all([
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
    supabase
      .from("orders")
      .select("id, order_number, service_id, services(name), quantity, price, status, created_at, currency")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("transactions")
      .select("amount, created_at")
      .eq("user_id", user.id)
      .eq("type", "order_deduction")
      .gte("created_at", sevenDaysAgo),
  ]);

  const recentOrders = recentOrdersRes.data ?? [];

  const totalSpent = (spendingRes.data ?? []).reduce(
    (sum, t) => sum + Math.abs(Number(t.amount)),
    0
  );

  // Build a 7-day spending series from real transaction rows only.
  const dayBuckets = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    dayBuckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of weekSpendingRes.data ?? []) {
    const key = new Date(row.created_at).toISOString().slice(0, 10);
    if (dayBuckets.has(key)) {
      dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + Math.abs(Number(row.amount)));
    }
  }
  const chartData: ChartPoint[] = Array.from(dayBuckets.entries()).map(
    ([key, value]) => ({
      label: new Date(`${key}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "short",
      }),
      value,
    })
  );
  const weekTotal = chartData.reduce((s, p) => s + p.value, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title={`Welcome back, ${user.full_name?.split(" ")[0] ?? "User"}`}
        description="Here's what's happening with your account today."
      >
        <Button asChild variant="gradient">
          <Link href="/services">
            <Layers /> New Order
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Balance"
          value={
            <AnimatedNumber
              value={Number(user.balance ?? 0)}
              format={(v) => formatCurrency(v, user.currency)}
            />
          }
          icon={<Wallet className="h-5 w-5" />}
          color="primary"
          description="Available balance"
        />
        <StatCard
          title="Today's Orders"
          value={<AnimatedNumber value={todayOrdersRes.count ?? 0} />}
          icon={<ShoppingBag className="h-5 w-5" />}
          color="info"
        />
        <StatCard
          title="Pending"
          value={<AnimatedNumber value={pendingRes.count ?? 0} />}
          icon={<Clock className="h-5 w-5" />}
          color="warning"
        />
        <StatCard
          title="Completed"
          value={<AnimatedNumber value={completedRes.count ?? 0} />}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="success"
        />
        <StatCard
          title="Cancelled"
          value={<AnimatedNumber value={cancelledRes.count ?? 0} />}
          icon={<XCircle className="h-5 w-5" />}
          color="destructive"
        />
        <StatCard
          title="Total Spent"
          value={
            <AnimatedNumber
              value={totalSpent}
              format={(v) => formatUsd(v)}
            />
          }
          icon={<TrendingUp className="h-5 w-5" />}
          color="info"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Spending — last 7 days</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Total this week: <span className="font-semibold text-foreground">{formatUsd(weekTotal)}</span>
              </p>
            </div>
            <Badge variant="subtle" className="hidden sm:inline-flex">
              {weekTotal > 0 ? "Active" : "No spend"}
            </Badge>
          </CardHeader>
          <CardContent>
            <MiniAreaChart
              data={chartData}
              height={180}
              formatValue={(v) => formatUsd(v)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-accent/50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <action.icon className="h-4 w-4" />
                </span>
                <span className="text-xs font-semibold leading-tight">{action.label}</span>
                <span className="text-[11px] text-muted-foreground">{action.description}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Recent Orders</h2>
            <p className="text-xs text-muted-foreground">
              {ordersRes.count ?? 0} order{(ordersRes.count ?? 0) === 1 ? "" : "s"} placed in total
            </p>
          </div>
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
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Order</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Service</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(recentOrders ?? []).map((order) => (
                      <tr key={order.id} className="border-b last:border-0 transition-colors hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <Link href={`/orders/${order.id}`} className="font-medium text-primary hover:underline">
                            #{order.order_number}
                          </Link>
                        </td>
                        <td className="max-w-[220px] px-4 py-3">
                          <span className="line-clamp-1">{truncate(order.services?.name ?? "Service", 40)}</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{order.quantity.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">{formatUsd(order.price)}</td>
                        <td className="px-4 py-3">
                          <OrderStatusBadge status={order.status as OrderStatus} />
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{formatDateTime(order.created_at, "MMM d, h:mm a")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="divide-y md:hidden">
                {(recentOrders ?? []).map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`/orders/${order.id}`}
                      className="block px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-primary">#{order.order_number}</span>
                        <OrderStatusBadge status={order.status as OrderStatus} />
                      </div>
                      <p className="mt-1 line-clamp-1 text-sm">{truncate(order.services?.name ?? "Service", 48)}</p>
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
      </div>
    </div>
  );
}
