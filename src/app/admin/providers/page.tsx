import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { AdminProviders } from "@/components/admin/providers/admin-providers";

export const revalidate = 0;

export default async function AdminProvidersPage() {
  const { user, error } = await requireAdmin();
  if (error || !user) return null;

  const supabase = await createClient();
  const [providersRes, servicesRes] = await Promise.all([
    supabase.from("providers").select("*").order("priority"),
    supabase.from("services").select("provider_id, id"),
  ]);

  const serviceCounts = (servicesRes.data ?? []).reduce<Record<string, number>>((acc, s) => {
    if (s.provider_id) acc[s.provider_id] = (acc[s.provider_id] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Providers"
        description="Connect unlimited SMM API providers. Credentials stay server-side."
      />
      <AdminProviders providers={providersRes.data ?? []} serviceCounts={serviceCounts} />
    </div>
  );
}
