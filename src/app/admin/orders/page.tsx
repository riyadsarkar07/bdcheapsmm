import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/guards";
import { computeOrderProfit } from "@/lib/order-profit";
import { PageHeader } from "@/components/page-header";
import { AdminOrders } from "@/components/admin/orders/admin-orders";

export const revalidate = 0;

export default async function AdminOrdersPage() {
  const { user, error } = await requireAdmin();
  if (error || !user) return null;

  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, user_id, profiles(full_name, email), services(name, provider_price), charge, provider_id, provider_order_id, quantity, price, status, created_at, currency")
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (orders ?? []).map((order) => ({
    id: order.id,
    order_number: order.order_number,
    user_id: order.user_id,
    profiles: order.profiles,
    services: order.services ? { name: order.services.name } : null,
    provider_id: order.provider_id,
    provider_order_id: order.provider_order_id,
    quantity: order.quantity,
    price: order.price,
    status: order.status,
    created_at: order.created_at,
    currency: order.currency,
    profit: computeOrderProfit(order, order.services),
  }));

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Manage all orders across the panel."
      />
      <AdminOrders orders={rows} />
    </div>
  );
}
