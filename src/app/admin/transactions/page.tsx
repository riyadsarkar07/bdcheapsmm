import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { AdminTransactions } from "@/components/admin/transactions/admin-transactions";

export const revalidate = 0;

export default async function AdminTransactionsPage() {
  const { user, error } = await requireAdmin();
  if (error || !user) return null;

  const supabase = await createClient();
  const { data: transactions } = await supabase
    .from("transactions")
    .select("*, profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(2000);

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="Every balance movement across all users — deposits, order charges, refunds and adjustments."
      />
      <AdminTransactions transactions={transactions ?? []} />
    </div>
  );
}
