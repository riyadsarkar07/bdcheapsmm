import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/guards";
import { getPublicSettings } from "@/lib/settings";
import { resolveScreenshotUrls } from "@/lib/supabase/storage";
import { PageHeader } from "@/components/page-header";
import { AddFundsInstructions } from "@/components/payments/add-funds-instructions";
import { AddFundsForm } from "@/components/payments/add-funds-form";
import { PaymentHistory } from "@/components/payments/payment-history";
import { formatCurrency } from "@/lib/utils";
import { Wallet, ArrowDownToLine } from "lucide-react";

export const revalidate = 0;

export default async function AddFundsPage() {
  const { user, error } = await requireUser();
  if (error || !user) return null;

  const supabase = await createClient();

  const [settings, paymentRequestsRes] = await Promise.all([
    getPublicSettings(),
    supabase
      .from("payment_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const rows = await resolveScreenshotUrls(supabase, paymentRequestsRes.data ?? []);
  const pending = rows.filter((r) => r.status === "pending").length;

  return (
    <div>
      <PageHeader
        eyebrow="Wallet"
        title="Add Funds"
        description="Deposit money into your account using bKash, Nagad or Rocket."
        icon={<ArrowDownToLine />}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="glass-card flex items-center gap-3 p-4 sm:col-span-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Wallet className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Current balance</p>
            <p className="truncate text-xl font-bold text-primary tabular-nums">
              {formatCurrency(user.balance, user.currency)}
            </p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
            <ArrowDownToLine className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Pending deposits</p>
            <p className="text-xl font-bold tabular-nums">{pending}</p>
          </div>
        </div>
      </div>

      <AddFundsInstructions />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AddFundsForm
          payments={settings.payments}
          currency={user.currency}
        />
        <PaymentHistory requests={rows} />
      </div>
    </div>
  );
}
