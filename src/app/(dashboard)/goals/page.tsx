import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { GoalTracker, type GoalCard } from "@/components/goals/goal-tracker";

export const revalidate = 0;

function progressForGoal(
  goal: { target_quantity: number; service_id: string | null; link: string | null },
  orders: { quantity: number; remain: number | null; link: string; service_id: string | null; status: string }[]
) {
  const contributing = orders.filter((o) => {
    if (["cancelled", "refunded", "failed", "rejected"].includes(o.status)) return false;
    if (goal.service_id && o.service_id !== goal.service_id) return false;
    if (goal.link) {
      try {
        const a = new URL(goal.link);
        const b = new URL(o.link);
        if (a.hostname.replace(/^www\./, "") !== b.hostname.replace(/^www\./, "")) return false;
        if (a.pathname.replace(/\/+$/, "") !== b.pathname.replace(/\/+$/, "")) return false;
      } catch {
        if (goal.link !== o.link) return false;
      }
    }
    return true;
  });

  const current = contributing.reduce((sum, o) => {
    if (o.status === "completed") return sum + o.quantity;
    const delivered = Math.max(0, o.quantity - (o.remain ?? o.quantity));
    return sum + delivered;
  }, 0);

  const remaining = Math.max(0, goal.target_quantity - current);
  const percent = Math.min(100, Math.round((current / Math.max(goal.target_quantity, 1)) * 100));
  return { current, remaining, percent };
}

export default async function GoalsPage() {
  const { user, error } = await requireUser();
  if (error || !user) return null;

  const supabase = await createClient();
  const [{ data: goals }, { data: orders }, { data: services }] = await Promise.all([
    supabase.from("order_goals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("quantity, remain, link, service_id, status")
      .eq("user_id", user.id),
    supabase.from("services").select("id, name").eq("is_active", true).order("name").limit(200),
  ]);

  const cards: GoalCard[] = (goals ?? []).map((goal) => {
    const { current, remaining, percent } = progressForGoal(goal, orders ?? []);
    const service = (services ?? []).find((s) => s.id === goal.service_id);
    return {
      ...goal,
      current_quantity: current,
      remaining,
      percent,
      service_name: service?.name ?? null,
    };
  });

  return (
    <div>
      <PageHeader
        title="Order Goal Tracker"
        description="Set follower, view or like targets and track progress from your existing orders."
      />
      <GoalTracker goals={cards} services={services ?? []} />
    </div>
  );
}
