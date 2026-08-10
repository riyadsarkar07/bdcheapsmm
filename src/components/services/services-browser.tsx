"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Search,
  Clock,
  ArrowRight,
  Minus,
  Plus,
  Heart,
  HeartOff,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { CategoryIcon } from "@/components/category-icon";
import { PageHeader } from "@/components/page-header";
import type { Category, ServiceWithCategory } from "@/lib/types/app";

export function ServicesBrowser() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const activeCategory = searchParams.get("category");
  const [search, setSearch] = React.useState(searchParams.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = React.useState(search ?? "");

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").eq("is_active", true).order("sort_order");
      return (data ?? []) as Category[];
    },
  });

  const { data: services, isLoading } = useQuery({
    queryKey: ["services", activeCategory, debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from("services")
        .select(
          "id, name, slug, description, price, min_quantity, max_quantity, average_time, type, is_active, is_featured, category_id, categories(name, slug, icon)"
        )
        .eq("is_active", true);

      if (activeCategory) {
        const { data: cat } = await supabase.from("categories").select("id").eq("slug", activeCategory).maybeSingle();
        if (cat) query = query.eq("category_id", cat.id);
      }

      if (debouncedSearch) {
        query = query.ilike("name", `%${debouncedSearch}%`);
      }

      query = query.order("price", { ascending: true }).limit(200);
      const { data } = await query;
      return (data ?? []) as ServiceWithCategory[];
    },
  });

  const { data: favorites } = useQuery({
    queryKey: ["favorites"],
    queryFn: async () => {
      const { data } = await supabase.from("favorites").select("service_id");
      return new Set((data ?? []).map((f) => f.service_id));
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile-balance"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, balance, currency").single();
      return data;
    },
  });

  async function toggleFavorite(serviceId: string, isFavorite: boolean) {
    if (isFavorite) {
      await supabase.from("favorites").delete().eq("service_id", serviceId);
    } else {
      await supabase.from("favorites").insert({ service_id: serviceId });
    }
    router.refresh();
  }

  function setCategory(slug: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) {
      params.set("category", slug);
    } else {
      params.delete("category");
    }
    router.push(`/services?${params.toString()}`);
  }

  return (
    <div>
      <PageHeader
        title="Services"
        description="Pick a service, enter your link and quantity — we handle the rest."
      >
        <Badge variant="info" className="hidden text-sm sm:inline-flex">
          Balance: {profile ? formatBalance(profile.balance, profile.currency) : "..."}
        </Badge>
      </PageHeader>

      {/* Category filter */}
      <div className="mb-5 flex flex-wrap gap-2">
        <button
          onClick={() => setCategory(null)}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
            !activeCategory
              ? "gradient-bg border-transparent text-white shadow"
              : "bg-background hover:bg-muted"
          )}
        >
          All
        </button>
        {(categories ?? []).map((category) => (
          <button
            key={category.id}
            onClick={() => setCategory(category.slug)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              activeCategory === category.slug
                ? "gradient-bg border-transparent text-white shadow"
                : "bg-background hover:bg-muted"
            )}
          >
            <CategoryIcon icon={category.icon} className="h-3.5 w-3.5" />
            {category.name}
          </button>
        ))}
      </div>

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

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : (services ?? []).length === 0 ? (
        <EmptyState
          title="No services found"
          description="Try a different search term or category."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(services ?? []).map((service, index) => {
            const isFavorite = favorites?.has(service.id) ?? false;
            return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(index * 0.02, 0.4) }}
                className="glass-card group flex flex-col rounded-xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-xl"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-bg text-white shadow">
                      <CategoryIcon icon={service.categories?.icon ?? null} className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {service.categories?.name ?? "General"}
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

                <Link href={`/services/${service.id}`} className="block">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug hover:text-primary">
                    {service.name}
                  </h3>
                </Link>

                {service.description ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {service.description}
                  </p>
                ) : null}

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
                      {formatCurrency(service.price, profile?.currency ?? "BDT")}
                      <span className="text-xs font-normal text-muted-foreground"> / 1k</span>
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/services/${service.id}`}>
                      Order <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatBalance(balance: number, currency: string): string {
  if (currency === "BDT") {
    return "৳" + balance.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return balance.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " " + currency;
}

function formatCurrency(price: number, currency: string): string {
  if (currency === "BDT") {
    return "৳" + Number(price).toFixed(2);
  }
  return Number(price).toFixed(2) + " " + currency;
}
