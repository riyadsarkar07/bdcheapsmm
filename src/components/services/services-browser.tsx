"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { cn, formatCurrency, formatUsd } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Search,
  Clock,
  ArrowRight,
  Minus,
  Plus,
  Heart,
  HeartOff,
  Hash,
  Layers,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { CategoryIcon } from "@/components/category-icon";
import { PageHeader } from "@/components/page-header";
import { OrderForm } from "@/components/services/order-form";
import {
  PLATFORMS,
  OTHER_PLATFORM,
  PLATFORM_LABELS,
  detectPlatform,
  exampleLinkForPlatform,
} from "@/lib/pricing";
import type { Category, Json } from "@/lib/types/database";

const PAGE_SIZE = 40;
const NULL_UUID = "00000000-0000-0000-0000-000000000000";

type ServiceRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  min_quantity: number;
  max_quantity: number;
  average_time: string | null;
  type: string | null;
  is_active: boolean;
  is_featured: boolean;
  provider_service_id: string | null;
  meta: Json | null;
  category_id: string | null;
  categories?: { name: string | null; slug: string | null; icon: string | null } | null;
  providers?: { id: string; name: string } | null;
};

type SelectedService = ServiceRow;

function parseMeta(meta: Json | null): Record<string, unknown> {
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    return meta as Record<string, unknown>;
  }
  return {};
}

function yesNo(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === "1" || value === 1 || value === "true" || value === true) return "Yes";
  if (value === "0" || value === 0 || value === "false" || value === false) return "No";
  return "—";
}

export function ServicesBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const supabase = createClient();

  const platform = searchParams.get("p") ?? "all";
  const category = searchParams.get("category");

  const [search, setSearch] = React.useState(searchParams.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = React.useState(search);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [limit, setLimit] = React.useState(PAGE_SIZE);
  const detailRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    setLimit(PAGE_SIZE);
    setSelectedId(null);
  }, [platform, category]);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      return (data ?? []) as Category[];
    },
  });

  // Group categories under their detected platform so the drilldown is driven
  // by real rows in the `categories` table (never fabricated).
  const platformGroups = React.useMemo(() => {
    const groups = new Map<string, Category[]>();
    for (const cat of categories ?? []) {
      const slug = detectPlatform(cat.name, cat.slug);
      const list = groups.get(slug) ?? [];
      list.push(cat);
      groups.set(slug, list);
    }
    return groups;
  }, [categories]);

  const platformCategoryIds = React.useMemo(() => {
    const m = new Map<string, string[]>();
    for (const [slug, cats] of platformGroups) m.set(slug, cats.map((c) => c.id));
    return m;
  }, [platformGroups]);

  // Platforms that actually have categories, in display order.
  const visiblePlatforms = React.useMemo(
    () => PLATFORMS.filter((p) => (platformGroups.get(p.slug)?.length ?? 0) > 0),
    [platformGroups]
  );
  const otherCount = platformGroups.get(OTHER_PLATFORM)?.length ?? 0;

  const activeCategories = platform === "all" ? [] : (platformGroups.get(platform) ?? []);

  const { data: profile } = useQuery({
    queryKey: ["profile-balance"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, balance, currency")
        .eq("id", auth.user.id)
        .maybeSingle();
      return data;
    },
    staleTime: 0,
    refetchInterval: 15_000,
  });

  const { data: authUser } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: favorites } = useQuery({
    queryKey: ["favorites"],
    queryFn: async () => {
      const { data } = await supabase.from("favorites").select("service_id");
      return new Set((data ?? []).map((f) => f.service_id));
    },
  });

  const { data: services, isLoading } = useQuery({
    queryKey: ["services", platform, category, debouncedSearch, limit],
    queryFn: async () => {
      let q = supabase
        .from("services")
        .select(
          "id, name, slug, description, price, min_quantity, max_quantity, average_time, type, is_active, is_featured, provider_service_id, meta, category_id, categories(name, slug, icon), providers(id, name)"
        )
        .eq("is_active", true);

      if (category) {
        q = q.eq("category_id", category);
      } else if (platform !== "all") {
        const ids = platformCategoryIds.get(platform) ?? [];
        if (platform === OTHER_PLATFORM) {
          q = ids.length
            ? q.or(`category_id.is.null,category_id.in.(${ids.join(",")})`)
            : q.is("category_id", null);
        } else if (ids.length) {
          q = q.in("category_id", ids);
        } else {
          q = q.eq("category_id", NULL_UUID);
        }
      }

      if (debouncedSearch) q = q.ilike("name", `%${debouncedSearch}%`);
      q = q.order("price", { ascending: true }).limit(limit);
      const { data } = await q;
      return (data ?? []) as ServiceRow[];
    },
  });

  // The selection always comes from the loaded list (which now includes the
  // provider embed), so derive it instead of issuing a second DB query.
  const selected = selectedId
    ? (services?.find((s) => s.id === selectedId) ?? null)
    : null;
  function setFilter(next: { p?: string; category?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.p) params.set("p", next.p);
    else if (next.p === "") params.delete("p");
    if (next.category) params.set("category", next.category);
    else if (next.category === null) params.delete("category");
    router.push(`/services?${params.toString()}`);
  }

  async function toggleFavorite(serviceId: string, isFavorite: boolean) {
    const uid = authUser?.id;
    if (!uid) return;
    if (isFavorite) {
      await supabase.from("favorites").delete().eq("user_id", uid).eq("service_id", serviceId);
    } else {
      await supabase.from("favorites").insert({ user_id: uid, service_id: serviceId });
    }
    queryClient.invalidateQueries({ queryKey: ["favorites"] });
  }

  function selectService(service: ServiceRow) {
    setSelectedId(service.id);
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const hasMore = (services?.length ?? 0) >= limit;

  const selectedPlatform = selected?.categories
    ? detectPlatform(selected.categories.name, selected.categories.slug)
    : platform;

  return (
    <div>
      <PageHeader
        title="Services"
        description="Pick a platform and service, enter your link and quantity — we handle the rest."
      >
        <Badge variant="info" className="hidden text-sm sm:inline-flex">
          Balance: {profile ? formatBalance(profile.balance, profile.currency) : "..."}
        </Badge>
      </PageHeader>

      {/* Platform selector */}
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter({ p: "", category: null })}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
            platform === "all"
              ? "gradient-bg border-transparent text-white shadow"
              : "bg-background hover:bg-muted"
          )}
        >
          All
        </button>
        {visiblePlatforms.map((p) => {
          const icon = platformGroups.get(p.slug)?.[0]?.icon ?? null;
          return (
            <button
              key={p.slug}
              onClick={() => setFilter({ p: p.slug, category: null })}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                platform === p.slug
                  ? "gradient-bg border-transparent text-white shadow"
                  : "bg-background hover:bg-muted"
              )}
            >
              <CategoryIcon icon={icon} className="h-3.5 w-3.5" />
              {p.name}
            </button>
          );
        })}
        {otherCount > 0 ? (
          <button
            onClick={() => setFilter({ p: OTHER_PLATFORM, category: null })}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              platform === OTHER_PLATFORM
                ? "gradient-bg border-transparent text-white shadow"
                : "bg-background hover:bg-muted"
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            Other
          </button>
        ) : null}
      </div>

      {/* Category selector for the active platform */}
      {activeCategories.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter({ category: null })}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              !category
                ? "gradient-bg border-transparent text-white shadow"
                : "bg-background hover:bg-muted"
            )}
          >
            All {PLATFORM_LABELS[platform] ?? "categories"}
          </button>
          {activeCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilter({ category: cat.id })}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                category === cat.id
                  ? "gradient-bg border-transparent text-white shadow"
                  : "bg-background hover:bg-muted"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      ) : null}

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search services..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Selected service: order form (left) + details (right) on desktop, stacked on mobile */}
      {selected ? (
        <div ref={detailRef} className="mb-8 grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <OrderForm
              serviceId={selected.id}
              serviceName={selected.name}
              pricePerUnit={Number(selected.price)}
              minQuantity={selected.min_quantity}
              maxQuantity={selected.max_quantity}
              balance={profile?.balance ?? 0}
              linkPlaceholder={exampleLinkForPlatform(selectedPlatform)}
            />
          </div>
          <div className="lg:col-span-3">
            <ServiceDetails service={selected} platform={selectedPlatform} />
          </div>
        </div>
      ) : null}

      {/* Service list */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : (services ?? []).length === 0 ? (
        <EmptyState
          title="No services found"
          description="Try a different platform, category or search term."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(services ?? []).map((service, index) => {
            const isFavorite = favorites?.has(service.id) ?? false;
            const isSelected = selectedId === service.id;
            const servicePlatform = detectPlatform(service.categories?.name, service.categories?.slug);
            return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(index * 0.01, 0.3) }}
                className={cn(
                  "glass-card group flex flex-col rounded-xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-xl",
                  isSelected && "ring-2 ring-primary/50"
                )}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-bg text-white shadow">
                      <CategoryIcon icon={service.categories?.icon ?? null} className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {PLATFORM_LABELS[servicePlatform] ?? servicePlatform}
                      </p>
                      {service.is_featured ? (
                        <Badge variant="info" className="mt-0.5 px-1.5 py-0 text-[9px]">Featured</Badge>
                      ) : null}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleFavorite(service.id, isFavorite)}
                    className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted"
                    aria-label="Toggle favorite"
                  >
                    {isFavorite ? (
                      <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
                    ) : (
                      <HeartOff className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{service.name}</h3>

                <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Minus className="h-3 w-3" /> {service.min_quantity.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Plus className="h-3 w-3" /> {service.max_quantity.toLocaleString()}
                  </span>
                  {service.average_time ? (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {service.average_time}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 flex items-center justify-between border-t pt-3">
                  <div>
                    <p className="text-lg font-bold text-primary">
                      {formatUsd(service.price)}
                      <span className="text-xs font-normal text-muted-foreground"> / 1k</span>
                    </p>
                  </div>
                  <Button size="sm" variant={isSelected ? "gradient" : "outline"} onClick={() => selectService(service)}>
                    {isSelected ? "Selected" : "Order"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {hasMore ? (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
            Load more services
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-2 last:border-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 text-right text-sm font-medium", mono && "font-mono text-xs")}>
        {value}
      </span>
    </div>
  );
}

function ServiceDetails({
  service,
  platform,
}: {
  service: SelectedService;
  platform: string;
}) {
  const meta = parseMeta(service.meta);
  const refill = yesNo(meta.refill);
  const cancel = yesNo(meta.cancel);
  const drop = yesNo(meta.drop);
  const driptype =
    typeof meta.driptype === "string" && meta.driptype ? meta.driptype : null;
  const speed = driptype ?? null;
  const guarantee =
    typeof meta.guarantee === "string" && meta.guarantee ? meta.guarantee : null;
  const quality =
    typeof meta.quality === "string" && meta.quality
      ? meta.quality
      : typeof meta.speed === "string" && meta.speed
        ? meta.speed
        : null;

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl gradient-bg text-white shadow-lg">
          <CategoryIcon icon={service.categories?.icon ?? null} className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {PLATFORM_LABELS[platform] ?? platform}
          </p>
          <h2 className="text-lg font-bold leading-snug">{service.name}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Provider: {service.providers?.name ?? "—"}
          </p>
        </div>
      </div>

      <div className="grid gap-x-6 sm:grid-cols-2">
        <div>
          <DetailRow
            label="Service ID"
            value={service.provider_service_id ?? "—"}
            mono
          />
          <DetailRow label="Rate / 1k" value={formatUsd(service.price)} />
          <DetailRow
            label="Min – Max"
            value={`${service.min_quantity.toLocaleString()} – ${service.max_quantity.toLocaleString()}`}
          />
          <DetailRow label="Start Time" value={service.average_time ?? "—"} />
          <DetailRow label="Speed" value={speed ?? "—"} />
          <DetailRow label="Guarantee" value={guarantee ?? "—"} />
        </div>
        <div>
          <DetailRow label="Refill" value={refill} />
          <DetailRow label="Cancel" value={cancel} />
          <DetailRow label="Drop" value={drop} />
          <DetailRow label="Quality" value={quality ?? "—"} />
          <DetailRow label="Type" value={service.type ?? "—"} />
          <DetailRow
            label="Example Link"
            value={
              <span className="block max-w-[240px] truncate text-xs text-muted-foreground">
                {exampleLinkForPlatform(platform)}
              </span>
            }
          />
        </div>
      </div>

      {service.description ? (
        <div className="mt-4 rounded-lg bg-muted/50 p-3">
          <p className="whitespace-pre-line text-sm text-muted-foreground">{service.description}</p>
        </div>
      ) : (
        <div className="mt-4 rounded-lg bg-muted/50 p-3">
          <p className="text-sm text-muted-foreground">No description available.</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">
          <Hash className="mr-1 h-3 w-3" /> {service.type ?? "standard"}
        </Badge>
        {service.is_featured ? <Badge variant="info">Featured</Badge> : null}
      </div>
    </div>
  );
}

function formatBalance(balance: number, currency: string): string {
  if (currency === "BDT") {
    return "৳" + balance.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return balance.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " " + currency;
}
