"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Activity,
  Loader2,
  RefreshCw,
  Server,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MinusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { checkProviderHealthAction } from "@/lib/actions/admin";
import { timeAgo } from "@/lib/utils";
import type { ProviderHealthStatus } from "@/lib/types/database";

export type ProviderHealthRow = {
  id: string;
  name: string;
  apiUrl: string;
  providerStatus: "active" | "inactive";
  priority: number;
  health: {
    status: ProviderHealthStatus;
    latencyMs: number | null;
    lastCheckedAt: string | null;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    lastError: string | null;
    totalChecks: number;
    totalFailures: number;
  } | null;
};

const statusConfig: Record<
  ProviderHealthStatus,
  { label: string; badge: "success" | "warning" | "destructive" | "subtle"; icon: React.ComponentType<{ className?: string }>; dot: string }
> = {
  healthy: { label: "Healthy", badge: "success", icon: CheckCircle2, dot: "bg-success" },
  slow: { label: "Slow", badge: "warning", icon: AlertTriangle, dot: "bg-warning" },
  down: { label: "Down", badge: "destructive", icon: XCircle, dot: "bg-destructive" },
  unknown: { label: "Not checked", badge: "subtle", icon: MinusCircle, dot: "bg-muted-foreground/40" },
};

export function AdminProviderHealth({
  rows,
  statusCounts,
}: {
  rows: ProviderHealthRow[];
  statusCounts: { healthy: number; slow: number; down: number; unknown: number };
}) {
  const router = useRouter();
  const [checkingId, setCheckingId] = React.useState<string | null>(null);

  async function checkNow(providerId: string) {
    setCheckingId(providerId);
    try {
      const result = await checkProviderHealthAction(providerId);
      if (result.success) {
        toast.success(result.message ?? "Health check complete");
      } else {
        toast.error(result.error ?? "Health check failed");
      }
      router.refresh();
    } finally {
      setCheckingId(null);
    }
  }

  const summary = [
    { key: "healthy" as const, label: "Healthy", value: statusCounts.healthy, className: "text-success" },
    { key: "slow" as const, label: "Slow", value: statusCounts.slow, className: "text-warning" },
    { key: "down" as const, label: "Down", value: statusCounts.down, className: "text-destructive" },
    { key: "unknown" as const, label: "Not checked", value: statusCounts.unknown, className: "text-muted-foreground" },
  ];

  return (
    <div>
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((item) => (
          <Card key={item.key}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
              <p className={`mt-1 text-2xl font-bold ${item.className}`}>{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No providers yet"
          description="Add an SMM provider first, then health checks will appear here."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((provider) => {
            const status = provider.health?.status ?? "unknown";
            const config = statusConfig[status];
            const StatusIcon = config.icon;
            return (
              <Card key={provider.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Activity className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="flex items-center gap-2 font-semibold">
                          {provider.name}
                          {provider.providerStatus !== "active" ? (
                            <span className="text-xs font-normal text-muted-foreground">(inactive)</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Priority {provider.priority}
                          {provider.apiUrl ? <span> · {provider.apiUrl}</span> : null}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${config.dot}`} />
                      <Badge variant={config.badge}>{config.label}</Badge>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <StatusIcon className="h-3.5 w-3.5" />
                      {provider.health?.latencyMs != null ? `${provider.health.latencyMs} ms` : "—"}
                    </span>
                    <span>Last checked: {provider.health?.lastCheckedAt ? timeAgo(provider.health.lastCheckedAt) : "never"}</span>
                    <span>{provider.health ? `${provider.health.totalChecks} checks · ${provider.health.totalFailures} failures` : "No data yet"}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {provider.health?.lastSuccessAt ? (
                      <span>Last success: {timeAgo(provider.health.lastSuccessAt)}</span>
                    ) : null}
                    {provider.health?.lastFailureAt ? (
                      <span className="text-destructive">Last failure: {timeAgo(provider.health.lastFailureAt)}</span>
                    ) : null}
                  </div>

                  {provider.health?.status === "down" && provider.health.lastError ? (
                    <p className="mt-3 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                      {provider.health.lastError}
                    </p>
                  ) : null}

                  <div className="mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => checkNow(provider.id)}
                      disabled={checkingId === provider.id || provider.providerStatus !== "active"}
                      title={provider.providerStatus !== "active" ? "Provider is inactive" : "Run a live check now"}
                    >
                      {checkingId === provider.id ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                      Check now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
