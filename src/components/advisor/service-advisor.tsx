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
import { recommendServicesAction, type AdvisorRecommendation } from "@/lib/actions/advisor";
import { formatUsd } from "@/lib/utils";

export function ServiceAdvisor() {
  const [goal, setGoal] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<AdvisorRecommendation[] | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await recommendServicesAction({ goal });
      if (result.success) {
        setResults(result.data ?? []);
      } else {
        toast.error(result.error ?? "Could not recommend services");
      }
    } finally {
      setLoading(false);
    }
  }

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

      {results && results.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="No matching services"
          description="Try a more specific goal such as Instagram followers or YouTube views."
        />
      ) : null}

      {results && results.length > 0 ? (
        <div className="grid gap-3">
          {results.map((service) => (
            <Card key={service.id}>
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
          ))}
        </div>
      ) : null}
    </div>
  );
}
