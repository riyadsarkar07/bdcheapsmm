import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { AdminSettings } from "@/components/admin/settings/admin-settings";
import { getSetting } from "@/lib/settings";

export const revalidate = 0;

export default async function AdminSettingsPage() {
  const { user, error } = await requireAdmin();
  if (error || !user) return null;

  const supabase = await createClient();
  const [site, general, payments, seo, footer] = await Promise.all([
    getSetting<{ name: string; tagline: string; logo: string | null; favicon: string | null }>("site"),
    getSetting<{ currency: string; timezone: string; maintenance_mode: boolean }>("general"),
    getSetting<{ bKash: string; nagad: string; rocket: string; enabled: string[] }>("payments"),
    getSetting<{ title: string; description: string; keywords: string }>("seo"),
    getSetting<{ text: string }>("footer"),
  ]);

  const defaults = {
    site: { name: "BD Cheap SMM", tagline: "", logo: null as string | null, favicon: null as string | null },
    general: { currency: "BDT", timezone: "Asia/Dhaka", maintenance_mode: false },
    payments: { bKash: "", nagad: "", rocket: "", enabled: ["bKash", "nagad", "rocket"] },
    seo: { title: "", description: "", keywords: "" },
    footer: { text: "" },
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Site-wide configuration. Currency and maintenance mode apply globally."
      />
      <AdminSettings
        initial={{
          site: { ...defaults.site, ...(site ?? {}) },
          general: { ...defaults.general, ...(general ?? {}) },
          payments: { ...defaults.payments, ...(payments ?? {}) },
          seo: { ...defaults.seo, ...(seo ?? {}) },
          footer: { ...defaults.footer, ...(footer ?? {}) },
        }}
      />
    </div>
  );
}
