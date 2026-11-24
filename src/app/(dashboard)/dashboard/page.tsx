import { CustomerText } from "@/components/customer-language";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { OrderStatusBadge, TransactionTypeBadge } from "@/components/status-badges";
import { AnimatedNumber } from "@/components/animated-number";
import { MiniAreaChart, type ChartPoint } from "@/components/dashboard/mini-area-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Wallet,
  ShoppingBag,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowDownToLine,
  Layers,
  TrendingUp,
  Lightbulb,
  Headphones,
  Megaphone,
} from "lucide-react";
import { formatCurrency, formatDateTime, truncate } from "@/lib/utils";
import type { OrderStatus, TransactionType } from "@/lib/types/database";

export const revalidate = 0;

const quickActions = [
  { href: "/services", label: "New Order", description: "Browse services", icon: Layers },
  { href: "/add-funds", label: "Add Funds", description: "Top up wallet", icon: ArrowDownToLine },
  { href: "/advisor", label: "Advisor", description: "Get a pick", icon: Lightbulb },
  { href: "/support", label: "Support", description: "We can help", icon: Headphones },
];

/** Log a Supabase error server-side only (message + code, never row data). */
function logQueryError(scope: string, error: { message: string; code?: string } | null) {
  if (!error) return;
  console.error(`[dashboard] ${scope} query failed: ${error.code ?? "unknown"} - ${error.message}`);
}

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
    processingRes,
    completedRes,
    cancelledRes,
    spendingRes,
    recentOrdersRes,
    weekSpendingRes,
    walletActivityRes,
    noticesRes,
    activeOrdersRes,
  ] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", startOfToday),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "pending"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("status", ["processing", "in_progress"]),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "completed"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "cancelled"),
    supabase.from("transactions").select("amount").eq("user_id", user.id).eq("type", "order_deduction"),
    supabase
      .from("orders")
      .select("id, order_number, provider_order_id, provider_status:provider_response->>status, service_id, services(name), quantity, price, status, created_at, currency")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("transactions")
      .select("amount, created_at")
      .eq("user_id", user.id)
      .eq("type", "order_deduction")
      .gte("created_at", sevenDaysAgo),
    supabase
      .from("transactions")
      .select("id, type, amount, description, created_at, currency")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("notices")
      .select("id, title, body, category, published_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(3),
    supabase.from("orders").select("id,order_number,status,provider_order_id,provider_status:provider_response->>status,checked_at:provider_response->>panel_checked_at,services(name)")
      .eq("user_id", user.id).in("status", ["pending","processing","in_progress"]).order("created_at", { ascending: false }).limit(8),
  ]);

  // Surface failures server-side without breaking the whole page.
  logQueryError("counts", ordersRes.error);
  logQueryError("today", todayOrdersRes.error);
  logQueryError("pending", pendingRes.error);
  logQueryError("processing", processingRes.error);
  logQueryError("completed", completedRes.error);
  logQueryError("cancelled", cancelledRes.error);
  logQueryError("spending", spendingRes.error);
  logQueryError("recentOrders", recentOrdersRes.error);
  logQueryError("weekSpending", weekSpendingRes.error);
  logQueryError("walletActivity", walletActivityRes.error);
  logQueryError("notices", noticesRes.error);

  const totalOrders = ordersRes.count ?? 0;
  const todayOrders = todayOrdersRes.count ?? 0;
  const pendingCount = pendingRes.count ?? 0;
  const processingCount = processingRes.count ?? 0;
  const completedCount = completedRes.count ?? 0;
  const cancelledCount = cancelledRes.count ?? 0;
  const recentOrders = recentOrdersRes.data ?? [];
  const walletActivity = walletActivityRes.data ?? [];
  const notices = noticesRes.data ?? [];

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

  const statusBreakdown = [
    { label: "Completed", value: completedCount, tone: "bg-success" },
    { label: "Processing", value: processingCount, tone: "bg-info" },
    { label: "Pending", value: pendingCount, tone: "bg-warning" },
    { label: "Cancelled", value: cancelledCount, tone: "bg-destructive" },
  ].filter((s) => s.value > 0);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        eyebrow="Overview"
        title={`Welcome back, ${user.full_name?.split(" ")[0] ?? "User"}`}
      />
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-gradient-to-r from-[var(--wallet-tint)] to-card p-5">
        <div>
          <p className="mb-1 flex items-center gap-2 text-sm text-muted-foreground"><Wallet className="h-4 w-4" /><CustomerText value="Wallet balance" /></p>
          <p className="text-3xl font-bold tracking-tight">{formatCurrency(user.balance, user.currency)}</p>
          <div className="mt-2 flex gap-4 text-sm text-primary">
            <Link href="/add-funds"><CustomerText value="Add Funds" /></Link>
            <Link href="/transactions"><CustomerText value="History" /></Link>
          </div>
        </div>
        <Button asChild className="bg-[#6d28d9] text-white hover:bg-[#5b21b6]"><Link href="/services"><Layers /><CustomerText value="New Order" /></Link></Button>
      </section>
      <section className="glass-card rounded-xl p-4">
        <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold"><CustomerText value="My active orders" /></h2>
          <Link className="text-sm text-primary" href="/orders"><CustomerText value="View all orders" /></Link></div>
        {activeOrdersRes.error ? <CustomerText value="Could not load active orders." /> : !activeOrdersRes.data?.length ? <CustomerText value="No active orders" /> :
          activeOrdersRes.data.map(order => <Link className="flex flex-wrap items-center justify-between gap-2 border-t py-2 text-sm" href={`/orders/${order.id}`} key={order.id}>
            <span>#{order.order_number} · {order.services?.name}</span>
            <OrderStatusBadge status={order.status} providerStatus={order.provider_status || (order.provider_order_id ? "Awaiting provider status" : null)} />
            <span className="text-xs text-muted-foreground"><CustomerText value="Last provider check" /> · {order.checked_at ? new Date(order.checked_at).toLocaleString("en-GB", {timeZone: "Asia/Dhaka"}) + " (Dhaka)" : <CustomerText value="Not checked yet" />}</span>
          </Link>)}
      </section>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            title="Total Orders"
            value={<AnimatedNumber value={totalOrders} />}
            icon={<ShoppingBag className="h-5 w-5" />}
            color="primary"
            description={`${todayOrders} today`}
          />
          <StatCard
            title="Completed"
            value={<AnimatedNumber value={completedCount} />}
            icon={<CheckCircle2 className="h-5 w-5" />}
            color="success"
          />
          <StatCard
            title="Processing"
            value={<AnimatedNumber value={processingCount} />}
            icon={<Loader2 className="h-5 w-5" />}
            color="info"
          />
          <StatCard
            title="Pending"
            value={<AnimatedNumber value={pendingCount} />}
            icon={<Clock className="h-5 w-5" />}
            color="warning"
          />
          <StatCard
            title="Cancelled"
            value={<AnimatedNumber value={cancelledCount} />}
            icon={<XCircle className="h-5 w-5" />}
            color="destructive"
          />
          <StatCard
            title="Total Spent"
            value={<AnimatedNumber value={totalSpent} format="currency" currency={user.currency} />}
            icon={<TrendingUp className="h-5 w-5" />}
            color="primary"
          />
      </div>

      {/* Chart + order status overview */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base"><CustomerText value="Spending — last 7 days" /></CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                <CustomerText value="Total this week:" />{" "}
                <span className="font-semibold text-foreground">{formatCurrency(weekTotal, user.currency)}</span>
              </p>
            </div>
            <Badge variant="subtle" className="hidden sm:inline-flex">
              {weekTotal > 0 ? "Active" : "No spend"}
            </Badge>
          </CardHeader>
          <CardContent>
            <MiniAreaChart data={chartData} height={180} currency={user.currency} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base"><CustomerText value="Order status" /></CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {totalOrders === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                <CustomerText value="No orders yet." />
              </p>
            ) : (
              statusBreakdown.map((s) => {
                const pct = Math.round((s.value / totalOrders) * 100);
                return (
                  <div key={s.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium"><CustomerText value={s.label} /></span>
                      <span className="tabular-nums text-muted-foreground">
                        {s.value} · {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${s.tone} transition-[width] duration-500`}
                        style={{ width: `${Math.max(pct, 3)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions + wallet activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base"><CustomerText value="Quick actions" /></CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group flex flex-col gap-2 rounded-xl border p-3 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-accent">
                  <action.icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold leading-tight"><CustomerText value={action.label} /></span>
                <span className="text-[11px] text-muted-foreground">{action.description}</span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base"><CustomerText value="Wallet activity" /></CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/transactions"><CustomerText value="All" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {walletActivity.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                <CustomerText value="No wallet activity yet." />
              </p>
            ) : (
              <ul className="divide-y">
                {walletActivity.map((tx) => {
                  const positive = Number(tx.amount) >= 0;
                  return (
                    <li key={tx.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <TransactionTypeBadge type={tx.type as TransactionType} />
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {tx.description ?? formatDateTime(tx.created_at, "MMM d, h:mm a")}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-sm font-semibold tabular-nums ${
                          positive ? "text-success" : "text-destructive"
                        }`}
                      >
                        {positive ? "+" : "−"}
                        {formatCurrency(Math.abs(Number(tx.amount)), tx.currency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notices */}
      {notices.length > 0 ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4 text-primary" /> Latest notices
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/notices">
                <CustomerText value="View all" /> <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {notices.map((notice) => (
              <Link
                key={notice.id}
                href="/notices"
                className="block rounded-lg border p-3 transition-colors hover:border-primary/30 hover:bg-accent/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="line-clamp-1 text-sm font-medium">{notice.title}</span>
                  <Badge variant="subtle" className="shrink-0 capitalize">
                    {notice.category}
                  </Badge>
                </div>
                {notice.body ? (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{notice.body}</p>
                ) : null}
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Recent orders */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold"><CustomerText value="Recent Orders" /></h2>
            <p className="text-xs text-muted-foreground">
              {totalOrders} order{totalOrders === 1 ? "" : "s"} placed in total
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/orders">
              <CustomerText value="View all" /> <ArrowRight />
            </Link>
          </Button>
        </div>

        {recentOrders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            description="Place your first order and watch your social media grow."
            action={
              <Button asChild className="bg-[#6d28d9] text-white hover:bg-[#5b21b6]">
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
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground"><CustomerText value="Order" /></th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground"><CustomerText value="Service" /></th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground"><CustomerText value="Amount" /></th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground"><CustomerText value="Date" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr key={order.id} className="border-b last:border-0 transition-colors hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <Link href={`/orders/${order.id}`} className="font-medium text-primary hover:underline">
                            #{order.order_number}
                          </Link>
                          {order.provider_order_id && (
                            <p className="break-all text-xs text-muted-foreground">Provider Order ID: {order.provider_order_id}</p>
                          )}
                        </td>
                        <td className="max-w-[220px] px-4 py-3">
                          <span className="line-clamp-1">{truncate(order.services?.name ?? "Service", 40)}</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{order.quantity.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">{formatCurrency(order.price, order.currency)}</td>
                        <td className="px-4 py-3">
                          <OrderStatusBadge providerStatus={order.provider_status || (order.provider_order_id ? "Awaiting provider status" : null)} status={order.status as OrderStatus} />
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{formatDateTime(order.created_at, "MMM d, h:mm a")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="divide-y md:hidden">
                {recentOrders.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`/orders/${order.id}`}
                      className="block px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-primary">#{order.order_number}</span>
                        <OrderStatusBadge providerStatus={order.provider_status || (order.provider_order_id ? "Awaiting provider status" : null)} status={order.status as OrderStatus} />
                      </div>
                      {order.provider_order_id && (
                        <p className="break-all text-xs text-muted-foreground">Provider Order ID: {order.provider_order_id}</p>
                      )}
                      <p className="mt-1 line-clamp-1 text-sm">{truncate(order.services?.name ?? "Service", 48)}</p>
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
      </div>
    </div>
  );
}
