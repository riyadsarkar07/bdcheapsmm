"use client";

import { Users, Wallet, Gift, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type PersonRef = { id: string; full_name: string | null; email: string | null };

export type AdminReferralRow = {
  id: string;
  created_at: string;
  referred: PersonRef | null;
  referrer: PersonRef | null;
  approvedDeposits: number;
  approvedDepositTotal: number;
  commissionCount: number;
  commissionTotal: number;
};

export type AdminCommissionRow = {
  id: string;
  created_at: string;
  referrer: PersonRef | null;
  referred: PersonRef | null;
  deposit_amount: number;
  rate_percent: number;
  amount: number;
  currency: string;
};

export function AdminReferrals({
  stats,
  referrals,
  commissions,
  currency,
}: {
  stats: {
    totalReferrals: number;
    pendingReferrals: number;
    rewardedReferrals: number;
    totalCommissions: number;
    totalCommissionAmount: number;
    totalReferralDeposits: number;
  };
  referrals: AdminReferralRow[];
  commissions: AdminCommissionRow[];
  currency: string;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Referred Users"
          value={stats.totalReferrals}
          icon={<Users className="h-5 w-5" />}
          color="primary"
          description={`${stats.rewardedReferrals} rewarded, ${stats.pendingReferrals} pending deposit`}
        />
        <StatCard
          title="Commissions Paid"
          value={stats.totalCommissions}
          icon={<Gift className="h-5 w-5" />}
          color="info"
          description="Number of commission grants"
        />
        <StatCard
          title="Commission Total"
          value={formatCurrency(stats.totalCommissionAmount, currency)}
          icon={<Wallet className="h-5 w-5" />}
          color="success"
          description="Credited to referrers"
        />
        <StatCard
          title="Referred Deposits"
          value={formatCurrency(stats.totalReferralDeposits, currency)}
          icon={<Clock className="h-5 w-5" />}
          color="warning"
          description="Approved deposits by referred users"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Referred Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {referrals.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No referrals yet" description="Referred users will appear here." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Referred User</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Referred By</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Deposits</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Deposited</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Commission</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((row) => (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <p className="font-medium">{row.referred?.full_name ?? row.referred?.email ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{row.referred?.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{row.referrer?.full_name ?? row.referrer?.email ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{row.referrer?.email}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(row.created_at)}</td>
                      <td className="px-4 py-3 text-right">{row.approvedDeposits}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {row.approvedDepositTotal > 0 ? formatCurrency(row.approvedDepositTotal, currency) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-success">
                        {row.commissionTotal > 0 ? `+${formatCurrency(row.commissionTotal, currency)}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {row.commissionCount > 0 ? (
                          <Badge variant="success">Rewarded</Badge>
                        ) : (
                          <Badge variant="warning">Pending</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Commission History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {commissions.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No commissions yet" description="Commissions earned from approved referral deposits will appear here." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Referrer</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Referred User</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Deposit</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Rate</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((row) => (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(row.created_at)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{row.referrer?.full_name ?? row.referrer?.email ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{row.referrer?.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{row.referred?.full_name ?? row.referred?.email ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{row.referred?.email}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency(row.deposit_amount, row.currency)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{row.rate_percent}%</td>
                      <td className="px-4 py-3 text-right font-semibold text-success">
                        +{formatCurrency(row.amount, row.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
