"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus, Target, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import {
  createOrderGoalAction,
  updateOrderGoalStatusAction,
  deleteOrderGoalAction,
} from "@/lib/actions/goals";
import { orderGoalSchema } from "@/lib/validations";
import { formatNumber } from "@/lib/utils";
import type { OrderGoal, OrderGoalMetric, OrderGoalStatus } from "@/lib/types/database";

export type GoalCard = OrderGoal & {
  current_quantity: number;
  remaining: number;
  percent: number;
  service_name: string | null;
};

const metricLabel: Record<OrderGoalMetric, string> = {
  followers: "Followers",
  views: "Views",
  likes: "Likes",
  comments: "Comments",
  custom: "Custom",
};

export function GoalTracker({
  goals,
  services,
}: {
  goals: GoalCard[];
  services: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="gradient" size="sm" onClick={() => setCreating(true)}>
          <Plus /> New Goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals yet"
          description="Track follower, view or like targets against your existing orders."
          action={
            <Button variant="gradient" onClick={() => setCreating(true)}>
              <Plus /> Create a goal
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((goal) => (
            <Card key={goal.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{goal.title}</CardTitle>
                  <Badge variant={goal.status === "active" ? "info" : goal.status === "completed" ? "success" : "subtle"}>
                    {goal.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {metricLabel[goal.metric]}
                  {goal.service_name ? ` · ${goal.service_name}` : ""}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={goal.percent} />
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-muted/60 p-2">
                    <p className="text-muted-foreground">Current</p>
                    <p className="mt-0.5 font-semibold">{formatNumber(goal.current_quantity)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-2">
                    <p className="text-muted-foreground">Target</p>
                    <p className="mt-0.5 font-semibold">{formatNumber(goal.target_quantity)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-2">
                    <p className="text-muted-foreground">Remaining</p>
                    <p className="mt-0.5 font-semibold">{formatNumber(goal.remaining)}</p>
                  </div>
                </div>
                {goal.link ? (
                  <p className="truncate text-[11px] text-muted-foreground">{goal.link}</p>
                ) : null}
                <div className="flex justify-end gap-1">
                  {goal.status === "active" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const result = await updateOrderGoalStatusAction(goal.id, "completed" as OrderGoalStatus);
                        if (result.success) {
                          toast.success("Goal marked complete");
                          router.refresh();
                        } else {
                          toast.error(result.error ?? "Failed");
                        }
                      }}
                    >
                      Mark complete
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="iconSm"
                    className="text-destructive hover:text-destructive"
                    onClick={async () => {
                      if (!confirm("Delete this goal?")) return;
                      const result = await deleteOrderGoalAction(goal.id);
                      if (result.success) {
                        toast.success("Goal deleted");
                        router.refresh();
                      } else {
                        toast.error(result.error ?? "Failed");
                      }
                    }}
                    aria-label="Delete goal"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {creating ? <GoalFormDialog services={services} onClose={() => setCreating(false)} /> : null}
    </div>
  );
}

function GoalFormDialog({
  services,
  onClose,
}: {
  services: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const form = useForm<z.infer<typeof orderGoalSchema>>({
    resolver: zodResolver(orderGoalSchema),
    defaultValues: {
      title: "",
      metric: "followers",
      targetQuantity: 1000,
      serviceId: "",
      link: "",
    },
  });

  async function onSubmit(values: z.infer<typeof orderGoalSchema>) {
    setLoading(true);
    try {
      const result = await createOrderGoalAction(values);
      if (result.success) {
        toast.success(result.message ?? "Goal created");
        router.refresh();
        onClose();
      } else {
        toast.error(result.error ?? "Failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New order goal</DialogTitle>
          <DialogDescription>
            Progress is calculated from your existing orders for the same link and/or service.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input {...form.register("title")} placeholder="10k Instagram followers" />
            {form.formState.errors.title ? (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Metric</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                {...form.register("metric")}
              >
                <option value="followers">Followers</option>
                <option value="views">Views</option>
                <option value="likes">Likes</option>
                <option value="comments">Comments</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Target quantity</Label>
              <Input type="number" min={1} {...form.register("targetQuantity")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Related service (optional)</Label>
            <select
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              {...form.register("serviceId")}
            >
              <option value="">Any matching orders</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Target URL (optional)</Label>
            <Input {...form.register("link")} placeholder="https://instagram.com/yourpage" />
            {form.formState.errors.link ? (
              <p className="text-xs text-destructive">{form.formState.errors.link.message}</p>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="gradient" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Target />}
              Create goal
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
