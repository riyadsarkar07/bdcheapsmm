import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/guards";
import { OrderDetailClient } from "@/components/orders/order-detail-client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, error } = await requireUser();
  if (error || !user) return null;

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("*, services(id, name, slug, type, provider_service_id), profiles(full_name, email)")
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();
  if (order.user_id !== user.id && user.role !== "admin") notFound();

  const { data: provider } = order.provider_id
    ? await supabase
        .from("providers")
        .select("id, name")
        .eq("id", order.provider_id)
        .maybeSingle()
    : { data: null };

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/orders">
          <ArrowLeft /> Back to orders
        </Link>
      </Button>
      <OrderDetailClient order={order} providerName={provider?.name ?? null} />
    </div>
  );
}
