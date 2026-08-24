import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/guards";
import { resolveScreenshotUrls } from "@/lib/supabase/storage";
import { PageHeader } from "@/components/page-header";
import { AdminPayments } from "@/components/admin/payments/admin-payments";

export const revalidate = 0;

export default async function AdminPaymentsPage() {
  const { user, error } = await requireAdmin();
  if (error || !user) return null;

  const supabase = await createClient();
  const { data: payments, error: queryError } = await supabase
    .from("payment_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (queryError) {
    return (
      <div>
        <PageHeader title="Payment Requests" description="Approve or reject deposit requests." />
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load payment requests: {queryError.message}
        </div>
      </div>
    );
  }

  // payment_requests has two FKs to profiles (user_id, processed_by), so a
  // direct profiles(...) embed is ambiguous. Fetch the requesters separately
  // and merge them in code.
  const userIds = Array.from(new Set((payments ?? []).map((p) => p.user_id).filter(Boolean)));
  let profilesById: Record<string, { full_name: string | null; email: string | null }> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);
    profilesById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  }
  const rows = (payments ?? []).map((p) => ({ ...p, profiles: profilesById[p.user_id] ?? null }));

  const resolved = await resolveScreenshotUrls(supabase, rows);

  return (
    <div>
      <PageHeader
        title="Payment Requests"
        description="Approve or reject deposit requests. Approval credits the user's balance instantly."
      />
      <AdminPayments payments={resolved} />
    </div>
  );
}
