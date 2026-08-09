import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { AdminAnnouncements } from "@/components/admin/announcements/admin-announcements";

export const revalidate = 0;

export default async function AdminAnnouncementsPage() {
  const { user, error } = await requireAdmin();
  if (error || !user) return null;

  const supabase = await createClient();
  const [{ data: recent }, { data: users }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*, profiles(full_name, email)")
      .eq("type", "system_announcement")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
  ]);

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Send system announcements to all users or a single user. They appear in the notification bell."
      />
      <AdminAnnouncements recent={recent ?? []} users={users ?? []} />
    </div>
  );
}
