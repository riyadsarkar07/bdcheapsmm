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
    .select("*, profiles(full_name, email, avatar_url)")
    .order("last_message_at", { ascending: false });

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

  return (
    <div>
      <PageHeader
        title="Support Tickets"
        description="Read and reply to user support requests. Replies are delivered in realtime."
      />
      <AdminSupport tickets={tickets ?? []} />
    </div>
  );
}
