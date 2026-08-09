import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { AdminOrders } from "@/components/admin/orders/admin-orders";

export const revalidate = 0;

export default async function AdminOrdersPage() {
  const { user, error } = await requireAdmin();
  if (error || !user) return null;

  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, user_id, profiles(full_name, email), services(name), provider_id, provider_order_id, quantity, price, status, created_at, currency")
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Manage all orders across the panel."
      />
      <AdminOrders orders={orders ?? []} />
    </div>
  );
}
