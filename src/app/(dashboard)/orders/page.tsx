import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { OrdersList } from "@/components/orders/orders-list";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
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

      <OrdersList initialOrders={orders ?? []} userId={user.id} statusFilter={status} />
    </div>
  );
}
