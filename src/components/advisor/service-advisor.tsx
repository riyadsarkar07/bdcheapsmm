"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Lightbulb, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import {
  recommendServicesAction,
  type AdvisorRecommendPayload,
  type AdvisorRecommendation,
} from "@/lib/actions/advisor";
import { formatUsd } from "@/lib/utils";

function ServiceCard({ service }: { service: AdvisorRecommendation }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{service.name}</p>
            {service.is_featured ? <Badge variant="info">Featured</Badge> : null}
            {service.category_name ? <Badge variant="secondary">{service.category_name}</Badge> : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{service.reason}</p>
          {service.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{service.description}</p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            {formatUsd(service.price)} / 1k · Min {service.min_quantity.toLocaleString()}
            {service.average_time ? ` · ${service.average_time}` : ""}
          </p>
        </div>
        <Button asChild variant="gradient" size="sm" className="shrink-0">
          <Link href={`/services/${service.id}`}>Order this</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function ServiceAdvisor() {
  const [goal, setGoal] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [payload, setPayload] = React.useState<AdvisorRecommendPayload | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await recommendServicesAction({ goal });
      if (result.success) {
        setPayload(result.data ?? { exact: [], related: [], interpretation: { platform: null, platformLabel: null, goalType: null, goalLabel: null } });
        setNotice(result.message ?? null);
      } else {
        toast.error(result.error ?? "Could not recommend services");
      }
    } finally {
      setLoading(false);
    }
  }

  const exact = payload?.exact ?? [];
  const related = payload?.related ?? [];
  const showEmpty = payload && exact.length === 0;

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="glass-card space-y-3 rounded-xl p-5">
        <label className="text-sm font-medium">What are you trying to grow?</label>
        <Textarea
          rows={4}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g. I need Instagram followers for my shop page, or YouTube views for a new video"
        />
        <Button type="submit" variant="gradient" disabled={loading || goal.trim().length < 3}>
          {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
          Get recommendations
        </Button>
      </form>

      {showEmpty ? (
        <EmptyState
          icon={Lightbulb}
          title="No exact match found"
          description={notice ?? "No service matches both the requested platform and goal. Try a more specific request such as YouTube views or Instagram followers."}
        />
      ) : null}

      {exact.length > 0 ? (
        <div className="grid gap-3">
          {exact.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      ) : null}

      {related.length > 0 ? (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Closely related services</h3>
            <p className="text-xs text-muted-foreground">
              These match the platform but not the exact goal type.
            </p>
          </div>
          <div className="grid gap-3">
            {related.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
