import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { AdminLogs } from "@/components/admin/logs/admin-logs";

export const revalidate = 0;

export default async function AdminLogsPage() {
  const { user, error } = await requireAdmin();
  if (error || !user) return null;

  const supabase = await createClient();
  const { data: logs, error: queryError } = await supabase
    .from("logs")
    .select("id, action, entity_type, entity_id, description, ip, created_at, profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(500);

  if (queryError) {
    return (
      <div>
        <PageHeader title="Audit Logs" description="Every administrative and user action, logged for review." />
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load audit logs: {queryError.message}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Every administrative and user action, logged for review."
      />
      <AdminLogs logs={logs ?? []} />
    </div>
  );
}
