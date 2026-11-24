import { createAdminClient } from "@/lib/supabase/admin";
import { providerApi } from "./smmfollow";
import { providerRefillFlag } from "@/lib/refill-terms";

export async function refreshRefillCatalog(force = false) {
  const db = createAdminClient();
  let query = db.from("providers").select("id,name,api_url,api_key").eq("status", "active");
  if (!force) {
    const cutoff = new Date(Date.now() - 3600000).toISOString();
    query = query.or(`refill_checked_at.is.null,refill_checked_at.lt.${cutoff}`);
  }
  const { data, error } = await query;
  if (error) throw new Error("Could not read provider configuration.");
  const results = await Promise.allSettled(data.map(async provider => {
    const checkedAt = new Date().toISOString();
    const catalog = await providerApi.getServices(provider);
    const flags: Record<string, boolean> = {};
    for (const service of catalog) {
      const flag = providerRefillFlag(service.refill);
      if (flag !== null) flags[service.service_id] = flag;
    }
    if (!Object.keys(flags).length) throw new Error("Provider returned no refill flags.");
    const saved = await db.rpc("sync_refill_flags", {p_provider: provider.id, p_flags: flags, p_checked_at: checkedAt});
    if (saved.error) throw new Error("Could not save provider refill flags.");
    return saved.data;
  }));
  return { changed: results.reduce((sum, result) => sum + (result.status === "fulfilled" ? result.value : 0), 0),
    failed: results.filter(result => result.status === "rejected").length };
}
