import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { AdminUsers } from "@/components/admin/users/admin-users";

export const revalidate = 0;

export default async function AdminUsersPage() {
  const { user, error } = await requireAdmin();
  if (error || !user) return null;

  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, balance, coin_balance, role, status, currency, country, timezone, referral_code, avatar_url, created_at, updated_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage all registered users."
      />
      <AdminUsers users={users ?? []} currentAdminId={user.id} />
    </div>
  );
}
