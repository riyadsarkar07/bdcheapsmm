import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
        ? "*, services(id, name, slug, type, provider_price), profiles(full_name, email)"
        : "*, services(id, name, slug, type), profiles(full_name, email)"
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
        order={order}
        providerName={isAdmin ? provider?.name ?? null : null}
        isAdmin={isAdmin}
        profit={profit}
      />
    </div>
  );
}
