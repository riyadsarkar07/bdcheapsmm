import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { AdminCoupons } from "@/components/admin/coupons/admin-coupons";

export const revalidate = 0;

export default async function AdminCouponsPage() {
  const { user, error } = await requireAdmin();
  if (error || !user) return null;

  const supabase = await createClient();
  const { data: coupons } = await supabase
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        title="Coupons"
        description="Create discount codes for deposits and orders. Codes are case-insensitive."
      />
      <AdminCoupons coupons={coupons ?? []} />
    </div>
  );
}
