import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { AdminProviderHealth } from "@/components/admin/provider-health/admin-provider-health";
import type { ProviderHealthStatus } from "@/lib/types/database";

export const revalidate = 0;

export default async function AdminProviderHealthPage() {
  const { user, error } = await requireAdmin();
  if (error || !user) return null;

  const supabase = await createClient();
  const [providersRes, healthRes] = await Promise.all([
    supabase.from("providers").select("id, name, api_url, status, priority").order("priority"),
    supabase.from("provider_health").select("*"),
  ]);

  const providers = providersRes.data ?? [];
  const healthById = new Map((healthRes.data ?? []).map((h) => [h.provider_id, h]));

  const rows = providers.map((provider) => {
    const health = healthById.get(provider.id);
    return {
      id: provider.id,
      name: provider.name,
      apiUrl: provider.api_url,
      providerStatus: provider.status,
      priority: provider.priority,
      health: health
        ? {
            status: health.status as ProviderHealthStatus,
            latencyMs: health.latency_ms,
            lastCheckedAt: health.last_checked_at,
            lastSuccessAt: health.last_success_at,
            lastFailureAt: health.last_failure_at,
            lastError: health.last_error,
            totalChecks: health.total_checks,
            totalFailures: health.total_failures,
          }
        : null,
    };
  });

  const statusCounts = { healthy: 0, slow: 0, down: 0, unknown: 0 };
  for (const row of rows) {
    const status = row.health?.status ?? "unknown";
    if (status === "healthy") statusCounts.healthy += 1;
    else if (status === "slow") statusCounts.slow += 1;
    else if (status === "down") statusCounts.down += 1;
    else statusCounts.unknown += 1;
  }

  return (
    <div>
      <PageHeader
        title="Provider Health"
        description="Live API availability for every SMM provider. Checks run automatically every 10 minutes."
      />
      <AdminProviderHealth rows={rows} statusCounts={statusCounts} />
    </div>
  );
}
