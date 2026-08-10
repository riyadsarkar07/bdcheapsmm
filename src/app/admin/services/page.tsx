import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { AdminServices } from "@/components/admin/services/admin-services";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Server } from "lucide-react";

export const revalidate = 0;

export default async function AdminServicesPage() {
  const { user, error } = await requireAdmin();
  if (error || !user) return null;

  const supabase = await createClient();
  const [servicesRes, categoriesRes, providersRes] = await Promise.all([
    supabase.from("services").select("id, name, category_id, provider_id, provider_service_id, price, provider_price, min_quantity, max_quantity, average_time, type, description, is_active, is_featured, profit_margin, pricing_mode, created_at").order("created_at", { ascending: false }).limit(1000),
    supabase.from("categories").select("id, name, slug").order("sort_order"),
    supabase.from("providers").select("id, name, status").order("priority"),
  ]);

  return (
    <div>
      <PageHeader
        title="Services"
        description="Manage, bulk-update and sync services."
      >
        <Button asChild variant="outline">
          <Link href="/admin/providers">
            <Server /> Sync from Provider
          </Link>
        </Button>
      </PageHeader>
      <AdminServices
        services={servicesRes.data ?? []}
        categories={categoriesRes.data ?? []}
        providers={providersRes.data ?? []}
      />
    </div>
  );
}
