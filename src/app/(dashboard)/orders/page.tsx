import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { OrdersList } from "@/components/orders/orders-list";
import { Button } from "@/components/ui/button";
import { Plus, ShoppingCart } from "lucide-react";
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
        eyebrow="Orders"
        title="My Orders"
        description="Track and manage all your orders."
        icon={<ShoppingCart />}
      >
        <Button asChild variant="gradient">
          <Link href="/services">
            <Plus /> New Order
          </Link>
        </Button>
      </PageHeader>

      <OrdersList initialOrders={orders ?? []} userId={user.id} statusFilter={status} />
    </div>
  );
}
