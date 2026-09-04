import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { AdminNotices } from "@/components/admin/notices/admin-notices";

export const revalidate = 0;

export default async function AdminNoticesPage() {
  const { user, error } = await requireAdmin();
  if (error || !user) return null;

  const supabase = await createClient();
  const { data: notices } = await supabase
    .from("notices")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        title="Notice Board"
        description="Create, publish and manage notices shown to users."
      />
      <AdminNotices notices={notices ?? []} />
    </div>
  );
}
