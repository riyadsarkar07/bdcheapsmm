import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicSettings } from "@/lib/settings";
import { getSessionProfile } from "@/lib/guards";
import { AppShell } from "@/components/layout/app-shell";
import type { Profile } from "@/lib/types/database";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getSessionProfile();

  if (!user || !profile) redirect("/login");

  if (profile.status === "banned") {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login?error=banned");
  }

  const settings = await getPublicSettings();

  return (
    <AppShell
      profile={profile as Profile}
      siteName={settings.site.name}
    >
      {children}
    </AppShell>
  );
}
