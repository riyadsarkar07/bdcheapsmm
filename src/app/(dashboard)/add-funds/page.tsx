import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/guards";
import { getPublicSettings } from "@/lib/settings";
import { resolveScreenshotUrls } from "@/lib/supabase/storage";
import { PageHeader } from "@/components/page-header";
import { AddFundsForm } from "@/components/payments/add-funds-form";
import { PaymentHistory } from "@/components/payments/payment-history";

export default async function AddFundsPage() {
  const { user, error } = await requireUser();
  if (error || !user) return null;

  const supabase = await createClient();
  const settings = await getPublicSettings();

  const { data: paymentRequests } = await supabase
    .from("payment_requests")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const rows = await resolveScreenshotUrls(supabase, paymentRequests ?? []);

  return (
    <div>
      <PageHeader
        title="Add Funds"
        description="Deposit money into your account using bKash, Nagad or Rocket."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <AddFundsForm
          payments={settings.payments}
          currency={user.currency}
        />
        <PaymentHistory requests={rows} />
      </div>
    </div>
  );
}
