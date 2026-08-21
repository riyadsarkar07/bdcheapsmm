import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { TransactionTypeBadge } from "@/components/status-badges";
import { formatCurrency, formatUsd, formatDateTime } from "@/lib/utils";
import type { TransactionType } from "@/lib/types/database";

export const revalidate = 0;

export default async function TransactionsPage() {
  const { user, error } = await requireUser();
  if (error || !user) return null;

  const supabase = await createClient();
  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const deposits = (transactions ?? []).filter((t) => t.type === "deposit").reduce((s, t) => s + Number(t.amount), 0);
  const spent = (transactions ?? []).filter((t) => t.type === "order_deduction").reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="Every deposit, order charge, refund and adjustment, all logged."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm text-muted-foreground">Total Deposits</p>
          <p className="mt-1 text-xl font-bold text-success">
            {formatCurrency(deposits, user.currency)}
          </p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm text-muted-foreground">Total Spent</p>
          <p className="mt-1 text-xl font-bold text-destructive">
            {formatUsd(spent)}
          </p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm text-muted-foreground">Current Balance</p>
          <p className="mt-1 text-xl font-bold text-primary">
            {formatCurrency(user.balance, user.currency)}
          </p>
        </div>
      </div>

      {(transactions ?? []).length === 0 ? (
        <EmptyState
          title="No transactions yet"
          description="Your transaction history will appear here."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Balance</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(transactions ?? []).map((tx) => (
                    <tr key={tx.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <TransactionTypeBadge type={tx.type as TransactionType} />
                      </td>
                      <td className="max-w-[320px] px-4 py-3">
                        <span className="line-clamp-1">{tx.description ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        <span className={tx.amount >= 0 ? "text-success" : "text-destructive"}>
                          {tx.amount >= 0 ? "+" : ""}
                          {formatCurrency(tx.amount, tx.currency)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {tx.balance_after != null ? formatCurrency(tx.balance_after, tx.currency) : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(tx.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
