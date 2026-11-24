import { CustomerText } from "@/components/customer-language";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refillTerms } from "@/lib/refill-terms";
import { formatCurrency } from "@/lib/utils";
import { requireUser, isAdminProfile } from "@/lib/guards";
import { computeOrderProfit } from "@/lib/order-profit";
import { OrderDetailClient } from "@/components/orders/order-detail-client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const maxDuration = 60;

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, error } = await requireUser();
  if (error || !user) return null;

  const isAdmin = isAdminProfile(user);
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      isAdmin
        ? "*, services(id, name, slug, meta, description, type, provider_price), profiles(full_name, email)"
        : "*, services(id, name, slug, meta, description, type), profiles(full_name, email)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();
  if (order.user_id !== user.id && !isAdmin) notFound();

  const { data: provider } = order.provider_id
    ? await supabase
        .from("providers")
        .select("id, name")
        .eq("id", order.provider_id)
        .maybeSingle()
    : { data: null };

  const terms = refillTerms(order.services?.meta, order.services?.name, order.services?.description ?? "");
  const [events, credits] = await Promise.all([
    createAdminClient().from("logs").select("id,created_at,description").eq("entity_type", "orders")
      .eq("entity_id", id).in("action", ["order_refill", "order_cancel"]).order("created_at"),
    supabase.from("transactions").select("id,created_at,amount,currency").eq("user_id", order.user_id)
      .eq("reference_id", id).eq("reference_type", "orders").eq("type", "refund"),
  ]);
  const history = [
    ...(events.data ?? []).map(e => ({ ...e, text: e.description })),
    ...(credits.data ?? []).map(e => ({ ...e, text: "Wallet credited " + formatCurrency(e.amount, e.currency) })),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at));

  const profit = isAdmin
    ? computeOrderProfit(order, order.services as { provider_price?: number | null } | null)
    : undefined;

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/orders">
          <ArrowLeft /> Back to orders
        </Link>
      </Button>
      <OrderDetailClient
        refillLabel={terms.label}
        refillDisabled={terms.disabled}
        order={order}
        providerName={isAdmin ? provider?.name ?? null : null}
        isOwner={user.id === order.user_id}
        isAdmin={isAdmin}
        profit={profit}
      />
      <section className="mt-5 space-y-3 rounded-xl border bg-card p-5">
        <h2 className="font-semibold"><CustomerText value="Refill and refund history" /></h2>
        {history.map(event => <div key={event.id} className="text-sm"><time className="text-muted-foreground">{new Date(event.created_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} (Dhaka)</time> · {event.text}</div>)}
        {(events.error || credits.error) ? <p>Some history could not be loaded.</p> : history.length === 0 && <p className="text-sm text-muted-foreground"><CustomerText value="No refill or refund activity recorded." /></p>}
      </section>
    </div>
  );
}
