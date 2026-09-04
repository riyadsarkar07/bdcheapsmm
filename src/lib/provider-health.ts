import type { SupabaseClient } from "@supabase/supabase-js";
import { providerApi } from "@/lib/provider/smmfollow";
import type {
  Database,
  Provider,
  ProviderHealthStatus,
} from "@/lib/types/database";

export const HEALTHY_LATENCY_MS = 3000;

export interface ProbeResult {
  ok: boolean;
  latencyMs: number;
  error: string | null;
}

export function deriveHealth(result: ProbeResult): ProviderHealthStatus {
  if (!result.ok) return "down";
  if (result.latencyMs > HEALTHY_LATENCY_MS) return "slow";
  return "healthy";
}

export async function probeProvider(
  provider: Pick<Provider, "api_url" | "api_key" | "name">
): Promise<ProbeResult> {
  if (!provider.api_url || !provider.api_key) {
    return { ok: false, latencyMs: 0, error: "API URL/key not configured" };
  }
  const startedAt = Date.now();
  try {
    await providerApi.getBalance(provider);
    return { ok: true, latencyMs: Date.now() - startedAt, error: null };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: (err as Error).message.slice(0, 500),
    };
  }
}

export async function recordProviderHealth(
  supabase: SupabaseClient<Database>,
  providerId: string,
  result: ProbeResult
): Promise<ProviderHealthStatus> {
  const status = deriveHealth(result);
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("provider_health")
    .select("last_success_at, last_failure_at, total_checks, total_failures")
    .eq("provider_id", providerId)
    .maybeSingle();

  const totalChecks = (existing?.total_checks ?? 0) + 1;
  const totalFailures = (existing?.total_failures ?? 0) + (result.ok ? 0 : 1);

  await supabase.from("provider_health").upsert(
    {
      provider_id: providerId,
      status,
      latency_ms: result.latencyMs,
      last_checked_at: now,
      last_success_at: result.ok ? now : (existing?.last_success_at ?? null),
      last_failure_at: result.ok ? (existing?.last_failure_at ?? null) : now,
      last_error: result.ok ? null : result.error,
      total_checks: totalChecks,
      total_failures: totalFailures,
      updated_at: now,
    },
    { onConflict: "provider_id" }
  );

  return status;
}

export async function runProviderHealthChecks(
  supabase: SupabaseClient<Database>,
  providers: Pick<Provider, "id" | "name" | "api_url" | "api_key" | "status">[]
): Promise<{ checked: number; healthy: number; slow: number; down: number }> {
  const tally = { checked: 0, healthy: 0, slow: 0, down: 0 };
  for (const provider of providers) {
    if (provider.status !== "active") continue;
    if (!provider.api_url || !provider.api_key) continue;
    const result = await probeProvider(provider);
    const status = await recordProviderHealth(supabase, provider.id, result);
    tally.checked += 1;
    if (status === "healthy") tally.healthy += 1;
    else if (status === "slow") tally.slow += 1;
    else tally.down += 1;
  }
  return tally;
}
