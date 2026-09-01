import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/guards";
import { getSetting } from "@/lib/settings";
import { PageHeader } from "@/components/page-header";
import { ReferralSettingsForm } from "@/components/admin/referrals/referral-settings-form";
import { AdminReferrals } from "@/components/admin/referrals/admin-referrals";
import { DEFAULT_REFERRAL_SETTINGS, type ReferralSettings } from "@/lib/types/app";

export const revalidate = 0;

type PersonRef = { id: string; full_name: string | null; email: string | null };

export default async function AdminReferralsPage() {
  const { user, error } = await requireAdmin();
  if (error || !user) return null;

  const supabase = await createClient();

  const [referralSettings, referralsRes, commissionsRes, general] = await Promise.all([
    getSetting<ReferralSettings>("referrals"),
    supabase
      .from("referrals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("referral_commissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000),
    getSetting<{ currency?: string }>("general"),
  ]);

  const currency = general?.currency ?? "BDT";
  const referrals = referralsRes.data ?? [];
  const commissions = commissionsRes.data ?? [];

  // referrals has two FKs to profiles (referrer_id, referred_user_id), so the
  // profiles(...) embed is ambiguous. Fetch profiles separately and merge.
  const userIds = Array.from(
    new Set(
      [
        ...referrals.flatMap((r) => [r.referrer_id, r.referred_user_id]),
        ...commissions.flatMap((c) => [c.referrer_id, c.referred_user_id]),
      ].filter(Boolean)
    )
  );
  let profilesById: Record<string, PersonRef> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);
    profilesById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  }

  // Approved deposits per referred user (count + volume) for status display.
  const referredIds = Array.from(new Set(referrals.map((r) => r.referred_user_id)));
  const depositsByReferred = new Map<string, { count: number; total: number }>();
  if (referredIds.length > 0) {
    const { data: deposits } = await supabase
      .from("payment_requests")
      .select("user_id, amount, currency")
      .in("user_id", referredIds)
      .eq("status", "approved");
    for (const d of deposits ?? []) {
      const entry = depositsByReferred.get(d.user_id) ?? { count: 0, total: 0 };
      entry.count += 1;
      entry.total += Number(d.amount);
      depositsByReferred.set(d.user_id, entry);
    }
  }

  const commissionsByReferred = new Map<string, typeof commissions>();
  for (const c of commissions) {
    const list = commissionsByReferred.get(c.referred_user_id) ?? [];
    list.push(c);
    commissionsByReferred.set(c.referred_user_id, list);
  }

  const referralRows = referrals.map((r) => {
    const userCommissions = commissionsByReferred.get(r.referred_user_id) ?? [];
    const deposits = depositsByReferred.get(r.referred_user_id);
    return {
      id: r.id,
      created_at: r.created_at,
      referred: profilesById[r.referred_user_id] ?? null,
      referrer: profilesById[r.referrer_id] ?? null,
      approvedDeposits: deposits?.count ?? 0,
      approvedDepositTotal: deposits?.total ?? 0,
      commissionCount: userCommissions.length,
      commissionTotal: userCommissions.reduce((s, c) => s + Number(c.amount), 0),
    };
  });

  const commissionRows = commissions.map((c) => ({
    id: c.id,
    created_at: c.created_at,
    referrer: profilesById[c.referrer_id] ?? null,
    referred: profilesById[c.referred_user_id] ?? null,
    deposit_amount: Number(c.deposit_amount),
    rate_percent: Number(c.rate_percent),
    amount: Number(c.amount),
    currency: c.currency,
  }));

  const totalCommissionAmount = commissions.reduce((s, c) => s + Number(c.amount), 0);
  const totalReferralDeposits = Array.from(depositsByReferred.values()).reduce(
    (s, d) => s + d.total,
    0
  );

  return (
    <div>
      <PageHeader
        title="Referrals"
        description="View referred users, deposits and commissions, and configure the commission rate."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <ReferralSettingsForm
            initialRate={referralSettings?.rate_percent ?? DEFAULT_REFERRAL_SETTINGS.rate_percent}
            initialEnabled={referralSettings?.enabled ?? DEFAULT_REFERRAL_SETTINGS.enabled}
          />
        </div>
        <div className="lg:col-span-2">
          <AdminReferrals
            stats={{
              totalReferrals: referrals.length,
              pendingReferrals: referrals.filter((r) => !commissionsByReferred.has(r.referred_user_id)).length,
              rewardedReferrals: referrals.filter((r) => commissionsByReferred.has(r.referred_user_id)).length,
              totalCommissions: commissions.length,
              totalCommissionAmount,
              totalReferralDeposits,
            }}
            referrals={referralRows}
            commissions={commissionRows}
            currency={currency}
          />
        </div>
      </div>
    </div>
  );
}
