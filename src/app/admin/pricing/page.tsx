import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { AdminPricing } from "@/components/admin/pricing/admin-pricing";
import Link from "next/link";
import { formatUsd } from "@/lib/utils";
import { getSetting } from "@/lib/settings";

export const revalidate = 0;

export default async function AdminPricingPage({ searchParams }: { searchParams: Promise<{ report?: string }> }) {
  const { user, error } = await requireAdmin();
  if (error || !user) return null;

  const supabase = await createClient();
  const pricing = await getSetting<{ global_profit_percentage: number; rounding: string }>("pricing");
  const globalCount = await supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("pricing_mode", "global")
    .not("provider_price", "is", null);

  const showLosses = (await searchParams).report === "losses";
  const losses: { id: string; name: string; price: number; provider_price: number }[] = [];
  let reportError = false;
  if (showLosses) {
    let after: string | undefined;
    for (;;) {
      let query = supabase.from("services").select("id,name,price,provider_price")
        .eq("is_active", true).gt("provider_price", 0).order("id").limit(500);
      if (after) query = query.gt("id", after);
      const { data, error } = await query;
      if (error) { reportError = true; break; }
      for (const row of data) {
        if (row.provider_price != null && row.price < row.provider_price) losses.push({ ...row, provider_price: row.provider_price });
      }
      if (data.length < 500) break;
      after = data[data.length - 1].id;
    }
    losses.sort((a, b) => (b.provider_price - b.price) - (a.provider_price - a.price));
  }
  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Pricing & Profit"
        description="Set the global profit percentage. Custom-price services are never changed."
      />
      <section className="mb-5 space-y-3 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Services selling below provider cost</h2>
        {!showLosses ? <Link prefetch={false} className="text-primary underline" href="?report=losses">Check current rates</Link> : <>
          {reportError && <p>Some service rates could not be loaded.</p>}
          {!reportError && !losses.length && <p>No active services with known costs are selling below cost.</p>}
          {losses.length > 0 && <div className="overflow-auto"><table className="w-full text-left text-sm">
            <thead><tr><th>Service</th><th>Sale / 1k</th><th>Provider / 1k</th><th>Loss / 1k</th></tr></thead>
            <tbody>{losses.map(row => <tr key={row.id} className="border-t"><td className="py-2">{row.name}</td><td>{formatUsd(row.price, 4)}</td><td>{formatUsd(row.provider_price, 4)}</td><td>{formatUsd(row.provider_price - row.price, 4)}</td></tr>)}</tbody>
          </table></div>}
        </>}
      </section>
      <AdminPricing
        initialGlobalProfit={pricing?.global_profit_percentage ?? null}
        initialRounding={(pricing?.rounding as "round2" | "round" | "ceil") ?? "round2"}
        globalServiceCount={globalCount.count ?? 0}
      />
    </div>
  );
}
