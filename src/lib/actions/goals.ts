"use server";

import { orderGoalSchema } from "@/lib/validations";
import { fail, ok, requireUser, type ActionResult } from "@/lib/guards";
import type { OrderGoalStatus } from "@/lib/types/database";

export async function createOrderGoalAction(input: unknown): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");
  const parsed = orderGoalSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid goal");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const serviceId = parsed.data.serviceId ? parsed.data.serviceId : null;

  const { error: insertError } = await supabase.from("order_goals").insert({
    user_id: user.id,
    title: parsed.data.title,
    metric: parsed.data.metric,
    target_quantity: parsed.data.targetQuantity,
    service_id: serviceId,
    link: parsed.data.link || null,
    status: "active",
  });
  if (insertError) return fail(insertError.message);
  return ok(undefined, "Goal created.");
}

export async function updateOrderGoalStatusAction(
  id: string,
  status: OrderGoalStatus
): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");
  if (!["active", "completed", "cancelled"].includes(status)) {
    return fail("Invalid status.");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error: updateError } = await supabase
    .from("order_goals")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);
  if (updateError) return fail(updateError.message);
  return ok(undefined, "Goal updated.");
}

export async function deleteOrderGoalAction(id: string): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error: delError } = await supabase
    .from("order_goals")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (delError) return fail(delError.message);
  return ok(undefined, "Goal deleted.");
}


