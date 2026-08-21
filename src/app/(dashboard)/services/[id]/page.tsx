import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/guards";
import { OrderForm } from "@/components/services/order-form";
import { CategoryIcon } from "@/components/category-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Minus, Plus, Info } from "lucide-react";
import { formatUsd } from "@/lib/utils";
import { detectPlatform, exampleLinkForPlatform } from "@/lib/pricing";

export default async function ServiceOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, error } = await requireUser();
  if (error || !user) return null;

  const supabase = await createClient();
  const { data: service } = await supabase
    .from("services")
    .select(
      "id, name, slug, description, price, min_quantity, max_quantity, average_time, type, is_active, is_featured, category_id, categories(name, slug, icon), providers(id, name)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!service) notFound();

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/services">
          <ArrowLeft /> Back to services
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Service info */}
        <div className="lg:col-span-3">
          <div className="glass-card rounded-xl p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-bg text-white shadow-lg">
                <CategoryIcon icon={service.categories?.icon ?? null} className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {service.categories?.name ?? "General"}
                </p>
                <h1 className="text-xl font-bold">{service.name}</h1>
              </div>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">Price / 1k</p>
                <p className="mt-0.5 text-lg font-bold text-primary">
                  {formatUsd(service.price)}
                </p>
              </div>
              <div className="rounded-lg bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">Min</p>
                <p className="mt-0.5 flex items-center gap-1 text-lg font-bold">
                  <Minus className="h-4 w-4 text-muted-foreground" />
                  {service.min_quantity.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">Max</p>
                <p className="mt-0.5 flex items-center gap-1 text-lg font-bold">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  {service.max_quantity.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">Avg. Time</p>
                <p className="mt-0.5 flex items-center gap-1 text-sm font-bold">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {service.average_time ?? "—"}
                </p>
              </div>
            </div>

            {service.description ? (
              <div className="mb-4">
                <h2 className="mb-2 text-sm font-semibold">Description</h2>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {service.description}
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {service.is_featured ? <Badge variant="info">Featured</Badge> : null}
              <Badge variant="secondary">Type: {service.type ?? "standard"}</Badge>
              {service.providers ? (
                <Badge variant="secondary">Provider: {service.providers.name}</Badge>
              ) : null}
            </div>
          </div>

          <div className="glass-card mt-4 flex items-start gap-3 rounded-xl p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              Make sure your link is correct and your account/page is public before
              placing the order. Refills are handled on a case-by-case basis. The
              order status is updated automatically.
            </p>
          </div>
        </div>

        {/* Order form */}
        <div className="lg:col-span-2">
          <OrderForm
            serviceId={service.id}
            serviceName={service.name}
            pricePerUnit={Number(service.price)}
            minQuantity={service.min_quantity}
            maxQuantity={service.max_quantity}
            balance={user.balance}
            linkPlaceholder={exampleLinkForPlatform(
              detectPlatform(service.categories?.name, service.categories?.slug)
            )}
          />
        </div>
      </div>
    </div>
  );
}
