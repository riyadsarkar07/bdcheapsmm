import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TransactionTypeBadge } from "@/components/status-badges";
import { formatCurrency, formatUsd, formatDateTime } from "@/lib/utils";
import { FileDown, History, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import type { TransactionType } from "@/lib/types/database";

export const revalidate = 0;

export default async function TransactionsPage() {
  const { user, error } = await requireUser();
  if (error || !user) return null;

  const supabase = await createClient();
  const [{ data: transactions }, { data: approvedDeposits }] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("payment_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "approved"),
  ]);

  const approvedDepositIds = new Set((approvedDeposits ?? []).map((p) => p.id));

  const deposits = (transactions ?? []).filter((t) => t.type === "deposit").reduce((s, t) => s + Number(t.amount), 0);
  const spent = (transactions ?? []).filter((t) => t.type === "order_deduction").reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  const summary = [
    {
      label: "Total Deposits",
      value: formatCurrency(deposits, user.currency),
      icon: TrendingUp,
      tone: "text-success",
      bg: "bg-success/10",
    },
    {
      label: "Total Spent",
      value: formatUsd(spent),
      icon: TrendingDown,
      tone: "text-destructive",
      bg: "bg-destructive/10",
    },
    {
      label: "Current Balance",
      value: formatCurrency(user.balance, user.currency),
      icon: Wallet,
      tone: "text-primary",
      bg: "bg-primary/10",
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Wallet"
        title="Transactions"
        description="Every deposit, order charge, refund and adjustment, all logged."
        icon={<History />}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3 sm:gap-4">
        {summary.map((item) => (
          <div key={item.label} className="glass-card flex items-center gap-3 p-4">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.bg} ${item.tone}`}>
              <item.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className={`truncate text-lg font-bold tabular-nums ${item.tone}`}>{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {(transactions ?? []).length === 0 ? (
        <EmptyState
          icon={History}
          title="No transactions yet"
          description="Your transaction history will appear here."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Balance</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {(transactions ?? []).map((tx) => (
                    <tr key={tx.id} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <TransactionTypeBadge type={tx.type as TransactionType} />
                      </td>
                      <td className="max-w-[320px] px-4 py-3">
                        <span className="line-clamp-1">{tx.description ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        <span className={tx.amount >= 0 ? "text-success" : "text-destructive"}>
                          {tx.amount >= 0 ? "+" : ""}
                          {formatCurrency(tx.amount, tx.currency)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                        {tx.balance_after != null ? formatCurrency(tx.balance_after, tx.currency) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatDateTime(tx.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        {tx.type === "deposit" &&
                        tx.reference_type === "payment_requests" &&
                        tx.reference_id &&
                        approvedDepositIds.has(tx.reference_id) ? (
                          <Button
                            asChild
                            variant="ghost"
                            size="iconSm"
                            title="Download deposit invoice"
                          >
                            <a
                              href={`/api/payments/${tx.reference_id}/invoice`}
                              download={`invoice-${tx.reference_id}.pdf`}
                            >
                              <FileDown className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y md:hidden">
              {(transactions ?? []).map((tx) => (
                <li key={tx.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <TransactionTypeBadge type={tx.type as TransactionType} />
                      <p className="mt-1 line-clamp-2 text-sm">{tx.description ?? "—"}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(tx.created_at)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-semibold tabular-nums ${tx.amount >= 0 ? "text-success" : "text-destructive"}`}>
                        {tx.amount >= 0 ? "+" : ""}
                        {formatCurrency(tx.amount, tx.currency)}
                      </p>
                      {tx.balance_after != null ? (
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          Bal: {formatCurrency(tx.balance_after, tx.currency)}
                        </p>
                      ) : null}
                      {tx.type === "deposit" &&
                      tx.reference_type === "payment_requests" &&
                      tx.reference_id &&
                      approvedDepositIds.has(tx.reference_id) ? (
                        <a
                          href={`/api/payments/${tx.reference_id}/invoice`}
                          download={`invoice-${tx.reference_id}.pdf`}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary"
                        >
                          <FileDown className="h-3 w-3" /> Invoice
                        </a>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
