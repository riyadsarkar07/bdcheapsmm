import {CustomerText} from "@/components/customer-language";
import {createAdminClient} from "@/lib/supabase/admin";
import {dhakaTime} from "@/lib/customer-order";
import { requireUser } from "@/lib/guards";
import { Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ProfileSettings } from "@/components/settings/profile-settings";
import {
  ActiveSessions,
  type ActiveSession,
} from "@/components/settings/active-sessions";
import { getSessionIdFromAccessToken } from "@/lib/session-security";
import {
  deviceLabel,
  locationLabel,
  parseUserAgent,
} from "@/lib/user-agent";

export const revalidate = 0;

export default async function SettingsPage() {
  const { user, error } = await requireUser();
  if (error || !user) return null;

  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const currentSessionId = getSessionIdFromAccessToken(session?.access_token);

  const { data: rawSessions } = await supabase.rpc("list_user_sessions");

  const recent=await createAdminClient().from("logs").select("created_at,action").eq("user_id",user.id).in("action",["login","logout"]).order("created_at",{ascending:false}).limit(10);
  const sessions: ActiveSession[] = (rawSessions ?? []).map((raw) => {
    const parsed = parseUserAgent(raw.user_agent);
    return {
      id: raw.id,
      device: deviceLabel(parsed),
      location: locationLabel({
        city: raw.city,
        region: raw.region,
        country: raw.country,
      }),
      deviceType: parsed.deviceType,
      createdAt: raw.created_at,
      lastSeenAt: raw.last_seen_at,
      isCurrent: currentSessionId !== null && raw.id === currentSessionId,
    };
  });

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Profile Settings"
        description="Update your personal information and manage account security."
        icon={<Settings />}
      />
      <div className="grid gap-6">
        <ProfileSettings user={user} />
        <ActiveSessions sessions={sessions} />
        <details className="glass-card p-4"><summary><CustomerText value="Recent sign-in activity"/></summary>{recent.data?.length?recent.data.map((r,i)=><p key={i}>{r.action==="login"?"Signed in":"Signed out"} · {dhakaTime(r.created_at)}</p>):<p><CustomerText value="No recent activity recorded."/></p>}</details>
      </div>
    </div>
  );
}
