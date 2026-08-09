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
  const { data: payments } = await supabase
    .from("payment_requests")
    .select("*, profiles(full_name, email)")
    .order("created_at", { ascending: false });

  const rows = await resolveScreenshotUrls(supabase, payments ?? []);

  return (
    <div>
      <PageHeader
        title="Payment Requests"
        description="Approve or reject deposit requests. Approval credits the user's balance instantly."
      />
      <AdminPayments payments={rows} />
    </div>
  );
}
