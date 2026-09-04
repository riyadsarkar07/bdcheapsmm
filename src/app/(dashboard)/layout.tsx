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
    const supabaseBanned = await createClient();
    await supabaseBanned.auth.signOut();
    redirect("/login?error=banned");
  }

  const settings = await getPublicSettings();
  const supabase = await createClient();
  const { data: publishedNotices } = await supabase
    .from("notices")
    .select("id")
    .eq("is_published", true);
  const publishedIds = (publishedNotices ?? []).map((n) => n.id);
  let readCount = 0;
  if (publishedIds.length > 0) {
    const { count } = await supabase
      .from("notice_reads")
      .select("notice_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("notice_id", publishedIds);
    readCount = count ?? 0;
  }
  const unreadNotices = Math.max(0, publishedIds.length - readCount);

  return (
    <AppShell
      profile={profile as Profile}
      siteName={settings.site.name}
      unreadNotices={unreadNotices}
    >
      {children}
    </AppShell>
  );
}
