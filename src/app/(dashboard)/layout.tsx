import { cookies } from "next/headers";
import { CustomerLanguage } from "@/components/customer-language";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicSettings } from "@/lib/settings";
import { getSessionProfile } from "@/lib/guards";
import { signOutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/layout/app-shell";
import type { Profile } from "@/lib/types/database";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getSessionProfile();

  if (!user) redirect("/login");
  if (!profile || profile.status === "banned") {
    return (
      <main className="mx-auto max-w-md space-y-4 p-6">
        <h1 className="text-xl font-semibold">{profile ? "Account suspended" : "Could not load your profile"}</h1>
        <p>{profile ? "Contact support about your account." : "Refresh the page to try again, or sign out."}</p>
        <form action={signOutAction}><Button>Sign out</Button></form>
      </main>
    );
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
    <CustomerLanguage initial={(await cookies()).get("customer_language")?.value === "bn" ? "bn" : "en"}>
    <AppShell
      profile={profile as Profile}
      siteName={settings.site.name}
      unreadNotices={unreadNotices}
    >
      {children}
    </AppShell>
    </CustomerLanguage>
  );
}
