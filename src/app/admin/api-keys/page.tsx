import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { AdminApiKeys } from "@/components/admin/api-keys/admin-api-keys";

export const revalidate = 0;

export default async function AdminApiKeysPage() {
  const { user, error } = await requireAdmin();
  if (error || !user) return null;

  const supabase = await createClient();
  const { data: apiKeys } = await supabase
    .from("api_keys")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        title="API Keys"
        description="Let resellers integrate the SMM API. Keys are shown only once at creation and stored hashed."
      />
      <AdminApiKeys apiKeys={apiKeys ?? []} />
    </div>
  );
}
