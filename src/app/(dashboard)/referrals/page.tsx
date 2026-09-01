import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/guards";
import { getSetting } from "@/lib/settings";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ReferralLinkCard } from "@/components/referrals/referral-link-card";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Users, Wallet, Clock, CheckCircle2 } from "lucide-react";
import { DEFAULT_REFERRAL_SETTINGS, type ReferralSettings } from "@/lib/types/app";

export const revalidate = 0;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

type ProfileRef = { id: string; full_name: string | null; email: string | null; created_at: string };

export default async function ReferralsPage() {
  const { user, error } = await requireUser();
  if (error || !user) return null;

  const supabase = await createClient();

  const [{ data: referrals }, { data: commissions }, referralSettings] = await Promise.all([
    supabase
      .from("referrals")
      .select("*")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("referral_commissions")
      .select("*")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false }),
    getSetting<ReferralSettings>("referrals"),
  ]);

  const ratePercent = referralSettings?.rate_percent ?? DEFAULT_REFERRAL_SETTINGS.rate_percent;
  const enabled = referralSettings?.enabled ?? DEFAULT_REFERRAL_SETTINGS.enabled;

  const referredIds = Array.from(new Set((referrals ?? []).map((r) => r.referred_user_id)));
  let profilesById: Record<string, ProfileRef> = {};
  if (referredIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, created_at")
      .in("id", referredIds);
    profilesById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  }

  const commissionsByReferred = new Map<string, typeof commissions>();
  for (const c of commissions ?? []) {
    const list = commissionsByReferred.get(c.referred_user_id) ?? [];
    list.push(c);
    commissionsByReferred.set(c.referred_user_id, list);
  }

  const totalEarned = (commissions ?? []).reduce((s, c) => s + Number(c.amount), 0);
  const totalReferrals = (referrals ?? []).length;
  const approvedCommissions = (commissions ?? []).length;
  const pendingReferrals = (referrals ?? []).filter(
    (r) => !commissionsByReferred.has(r.referred_user_id)
  ).length;

  const history = (referrals ?? []).map((referral) => {
    const userCommissions = commissionsByReferred.get(referral.referred_user_id) ?? [];
    return {
      ...referral,
      profile: profilesById[referral.referred_user_id] ?? null,
      depositTotal: userCommissions.reduce((s, c) => s + Number(c.deposit_amount), 0),
      commissionTotal: userCommissions.reduce((s, c) => s + Number(c.amount), 0),
      commissionCount: userCommissions.length,
    };
  });

  const referralLink = user.referral_code
    ? `${APP_URL}/register?ref=${user.referral_code}`
    : "";

  return (
    <div>
      <PageHeader
        title="Referrals"
        description="Share your link and earn a commission every time a referred user tops up."
      />

      {!user.referral_code ? (
        <EmptyState
          title="No referral code assigned"
          description="Contact support if you believe this is a mistake."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <ReferralLinkCard
              code={user.referral_code}
              link={referralLink}
              ratePercent={ratePercent}
              enabled={enabled}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Total Referrals"
                value={totalReferrals}
                icon={<Users className="h-5 w-5" />}
                color="primary"
                description="Users who signed up via your link"
              />
              <StatCard
                title="Total Earned"
                value={formatCurrency(totalEarned, user.currency)}
                icon={<Wallet className="h-5 w-5" />}
                color="success"
                description={`${ratePercent}% commission per approved deposit`}
              />
              <StatCard
                title="Pending"
                value={pendingReferrals}
                icon={<Clock className="h-5 w-5" />}
                color="warning"
                description="Referred users without an approved deposit yet"
              />
              <StatCard
                title="Commissions"
                value={approvedCommissions}
                icon={<CheckCircle2 className="h-5 w-5" />}
                color="info"
                description="Approved commissions credited"
              />
            </div>

            <div className="mt-6">
              {history.length === 0 ? (
                <EmptyState
                  title="No referrals yet"
                  description="Share your referral link to start earning commissions."
                />
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Referred User</th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Deposited</th>
                            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Commission</th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((row) => (
                            <tr key={row.id} className="border-b last:border-0 hover:bg-muted/50">
                              <td className="px-4 py-3">
                                <p className="font-medium">{row.profile?.full_name ?? row.profile?.email ?? "—"}</p>
                                <p className="text-xs text-muted-foreground">{row.profile?.email}</p>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {formatDateTime(row.profile?.created_at ?? row.created_at)}
                              </td>
                              <td className="px-4 py-3 text-right font-medium">
                                {row.depositTotal > 0
                                  ? formatCurrency(row.depositTotal, user.currency)
                                  : "—"}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-success">
                                {row.commissionTotal > 0
                                  ? `+${formatCurrency(row.commissionTotal, user.currency)}`
                                  : "—"}
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
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
