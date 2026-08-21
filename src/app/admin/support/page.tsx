import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { AdminSupport } from "@/components/admin/support/admin-support";

export const revalidate = 0;

export default async function AdminSupportPage() {
  const { user, error } = await requireAdmin();
  if (error || !user) return null;

  const supabase = await createClient();
  const { data: tickets, error: queryError } = await supabase
    .from("tickets")
    .select("id, ticket_number, subject, status, priority, category, user_id, assigned_to, last_message_at, created_at, updated_at")
    .order("last_message_at", { ascending: false })
    .limit(200);

  if (queryError) {
    return (
      <div>
        <PageHeader title="Support Tickets" description="Read and reply to user support requests." />
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load support tickets: {queryError.message}
        </div>
      </div>
    );
  }

  // tickets has two FKs to profiles (user_id, assigned_to), so a direct
  // profiles(...) embed is ambiguous. Fetch the ticket owners separately and
  // merge them in code.
  const userIds = Array.from(new Set((tickets ?? []).map((t) => t.user_id).filter(Boolean)));
  let profilesById: Record<string, { full_name: string | null; email: string | null; avatar_url: string | null }> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", userIds);
    profilesById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  }
  const rows = (tickets ?? []).map((t) => ({ ...t, profiles: profilesById[t.user_id] ?? null }));

  return (
    <div>
      <PageHeader
        title="Support Tickets"
        description="Read and reply to user support requests. Replies are delivered in realtime."
      />
      <AdminSupport tickets={rows} />
    </div>
  );
}
