import { requireUser } from "@/lib/guards";
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
        title="Profile Settings"
        description="Update your personal information and manage account security."
      />
      <div className="grid gap-6">
        <ProfileSettings user={user} />
        <ActiveSessions sessions={sessions} />
      </div>
    </div>
  );
}
