import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/status-badges";
import {
  Users,
  ShoppingCart,
  Banknote,
  Ticket,
  Wallet,
  Layers,
  Server,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from "lucide-react";
import { formatCurrency, formatUsd, formatDateTime, truncate } from "@/lib/utils";
import type { OrderStatus, PaymentStatus } from "@/lib/types/database";

export default async function AdminDashboardPage() {
  const { user, error } = await requireAdmin();
  if (error || !user) return null;

  const supabase = await createClient();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [
    usersRes,
    newUsersToday,
    ordersRes,
    ordersToday,
    pendingOrders,
    completedOrders,
    cancelledOrders,
    revenueRes,
    pendingPayments,
    openTickets,
    activeServices,
    activeProviders,
    recentOrders,
    recentPayments,
    recentUsers,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", startOfToday),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", startOfToday),
    supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["pending", "processing", "in_progress"]),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "cancelled"),
    supabase.from("transactions").select("amount").eq("type", "order_deduction"),
    supabase.from("payment_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("tickets").select("id", { count: "exact", head: true }).in("status", ["open", "waiting"]),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("providers").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("orders")
      .select("id, order_number, user_id, profiles(full_name, email), services(name), quantity, price, status, created_at, currency")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("payment_requests")
      .select("id, user_id, method, amount, currency, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("profiles")
      .select("id, full_name, email, balance, currency, role, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const revenue = (revenueRes.data ?? []).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  // payment_requests has two FKs to profiles (user_id, processed_by), so the
  // profiles(...) embed is ambiguous. Fetch the requesters separately.
  const paymentUserIds = Array.from(
    new Set((recentPayments.data ?? []).map((p) => p.user_id).filter(Boolean))
  );
  let paymentProfilesById: Record<string, { full_name: string | null; email: string | null }> = {};
  if (paymentUserIds.length > 0) {
    const { data: paymentProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", paymentUserIds);
    paymentProfilesById = Object.fromEntries((paymentProfiles ?? []).map((p) => [p.id, p]));
  }
  const recentPaymentsWithProfiles = (recentPayments.data ?? []).map((p) => ({
    ...p,
    profiles: paymentProfilesById[p.user_id] ?? null,
  }));

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        description="Overview of your SMM panel."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Total Users" value={usersRes.count ?? 0} icon={<Users className="h-5 w-5" />} color="primary" description={`${newUsersToday.count ?? 0} new today`} />
        <StatCard title="Total Orders" value={ordersRes.count ?? 0} icon={<ShoppingCart className="h-5 w-5" />} color="info" description={`${ordersToday.count ?? 0} today`} />
        <StatCard title="Pending Orders" value={pendingOrders.count ?? 0} icon={<Clock className="h-5 w-5" />} color="warning" />
        <StatCard title="Deposits (Pending)" value={pendingPayments.count ?? 0} icon={<Banknote className="h-5 w-5" />} color="destructive" />
        <StatCard title="Open Tickets" value={openTickets.count ?? 0} icon={<Ticket className="h-5 w-5" />} color="warning" />
        <StatCard title="Total Revenue" value={formatUsd(revenue)} icon={<TrendingUp className="h-5 w-5" />} color="success" description="From all order charges" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Completed Orders" value={completedOrders.count ?? 0} icon={<CheckCircle2 className="h-5 w-5" />} color="success" />
        <StatCard title="Cancelled Orders" value={cancelledOrders.count ?? 0} icon={<XCircle className="h-5 w-5" />} color="destructive" />
        <StatCard title="Active Services" value={activeServices.count ?? 0} icon={<Layers className="h-5 w-5" />} color="info" />
        <StatCard title="Active Providers" value={activeProviders.count ?? 0} icon={<Server className="h-5 w-5" />} color="info" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Orders</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(recentOrders.data ?? []).length === 0 ? (
                <div className="p-6">
                  <EmptyState title="No orders yet" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Order</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Service</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(recentOrders.data ?? []).map((order) => (
                        <tr key={order.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="px-4 py-3">
                            <Link href={`/orders/${order.id}`} className="font-medium text-primary hover:underline">
                              #{order.order_number}
                            </Link>
                          </td>
                          <td className="max-w-[140px] px-4 py-3">
                            <span className="line-clamp-1">{order.profiles?.full_name ?? order.profiles?.email ?? "—"}</span>
                          </td>
                          <td className="max-w-[180px] px-4 py-3">
                            <span className="line-clamp-1">{truncate(order.services?.name ?? "—", 30)}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium">{formatUsd(order.price)}</td>
                          <td className="px-4 py-3">
                            <OrderStatusBadge status={order.status as OrderStatus} />
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

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pending Payments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {recentPaymentsWithProfiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending payments.</p>
              ) : (
                recentPaymentsWithProfiles.map((payment) => (
                  <Link
                    key={payment.id}
                    href="/admin/payments"
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:border-primary/40"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">{formatCurrency(payment.amount, payment.currency)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {payment.method} · {payment.profiles?.full_name ?? payment.profiles?.email}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(payment.created_at, "MMM d, h:mm a")}</p>
                    </div>
                    <PaymentStatusBadge status={payment.status as PaymentStatus} />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Newest Users</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4">
              {(recentUsers.data ?? []).map((profileRow) => (
                <div key={profileRow.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-medium">{profileRow.full_name ?? "User"}</p>
                    <p className="truncate text-xs text-muted-foreground">{profileRow.email}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-primary">
                    {formatCurrency(profileRow.balance, profileRow.currency)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
