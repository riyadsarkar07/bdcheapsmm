import { cache } from "react";
import type { Json } from "@/lib/types/database";
import type {
  FooterSettings,
  GeneralSettings,
  PaymentSettings,
  PublicSettings,
  SeoSettings,
  SiteSettings,
} from "@/lib/types/app";

const PUBLIC_KEYS = ["site", "general", "payments", "seo", "footer"] as const;

export const getPublicSettings = cache(async function getPublicSettings() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", [...PUBLIC_KEYS]);

  if (error) {
    return defaults;
  }

  const result: PublicSettings = {
    site: defaults.site,
    general: defaults.general,
    payments: defaults.payments,
    seo: defaults.seo,
    footer: defaults.footer,
  };

  for (const row of data ?? []) {
    const value = row.value as Record<string, unknown>;
    if (row.key === "site") result.site = { ...defaults.site, ...value } as SiteSettings;
    if (row.key === "general") result.general = { ...defaults.general, ...value } as GeneralSettings;
    if (row.key === "payments") result.payments = { ...defaults.payments, ...value } as PaymentSettings;
    if (row.key === "seo") result.seo = { ...defaults.seo, ...value } as SeoSettings;
    if (row.key === "footer") result.footer = { ...defaults.footer, ...value } as FooterSettings;
  }

  return result;
});

export async function getSetting<T = Json>(key: string): Promise<T | null> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return null;
  return data.value as T;
}

export async function setSetting(
  key: string,
  value: Json,
  isPublic = false
): Promise<void> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.from("settings").upsert(
    { key, value, is_public: isPublic },
    { onConflict: "key" }
  );
}

const defaults: PublicSettings = {
  site: {
    name: "BD Cheap SMM",
    tagline: "Cheap & reliable SMM panel in Bangladesh",
    logo: null,
    favicon: null,
  },
  general: {
    currency: "BDT",
    timezone: "Asia/Dhaka",
    maintenance_mode: false,
  },
  payments: { bKash: "", nagad: "", rocket: "", enabled: ["bKash", "nagad", "rocket"] },
  seo: {
    title: "BD Cheap SMM - Buy Cheap SMM Services",
    description:
      "Buy Facebook, Instagram, YouTube, TikTok followers & likes at the cheapest rates in Bangladesh.",
    keywords: "smm, panel, bd cheap smm, followers, likes",
  },
  footer: { text: "© {year} BD Cheap SMM. All rights reserved.", links: [] },
};
