import { requireUser } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { ProfileSettings } from "@/components/settings/profile-settings";

export default async function SettingsPage() {
  const { user, error } = await requireUser();
  if (error || !user) return null;

  return (
    <div>
      <PageHeader
        title="Profile Settings"
        description="Update your personal information and preferences."
      />
      <ProfileSettings user={user} />
    </div>
  );
}
