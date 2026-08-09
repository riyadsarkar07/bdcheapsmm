import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicSettings } from "@/lib/settings";
import { AppShell } from "@/components/layout/app-shell";
import type { Profile } from "@/lib/types/database";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/login");
  if (profile.status === "banned") {
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
