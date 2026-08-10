import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { AdminPricing } from "@/components/admin/pricing/admin-pricing";
import { getSetting } from "@/lib/settings";

export const revalidate = 0;

export default async function AdminPricingPage() {
  const { user, error } = await requireAdmin();
  if (error || !user) return null;

  const supabase = await createClient();
  const pricing = await getSetting<{ global_profit_percentage: number; rounding: string }>("pricing");
  const globalCount = await supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("pricing_mode", "global")
    .not("provider_price", "is", null);

  return (
    <div>
      <PageHeader
        title="Pricing & Profit"
        description="Set the global profit percentage. Custom-price services are never changed."
      />
      <AdminPricing
        initialGlobalProfit={pricing?.global_profit_percentage ?? null}
        initialRounding={(pricing?.rounding as "round2" | "round" | "ceil") ?? "round2"}
        globalServiceCount={globalCount.count ?? 0}
      />
    </div>
  );
}
