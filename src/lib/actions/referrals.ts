"use server";

import { fail, ok, requireAdmin, type ActionResult } from "@/lib/guards";
import { referralSettingsSchema } from "@/lib/validations";
import { setSetting } from "@/lib/settings";
import { writeLog } from "@/lib/audit";
import type { ReferralSettings } from "@/lib/types/app";

/**
 * Admin-only: update the configurable referral commission rate. The value is
 * validated server-side and persisted to the settings table; the DB RPC that
 * grants commissions reads this rate directly, never from the client.
 */
export async function updateReferralSettingsAction(input: unknown): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");

  const parsed = referralSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.errors[0]?.message ?? "Invalid referral settings");
  }

  await setSetting(
    "referrals",
    { rate_percent: parsed.data.ratePercent, enabled: parsed.data.enabled } satisfies ReferralSettings,
    true
  );

  await writeLog({
    userId: user.id,
    action: "settings_update",
    entityType: "settings",
    entityId: "referrals",
    description: `Updated referral commission settings (rate ${parsed.data.ratePercent}%, ${parsed.data.enabled ? "enabled" : "disabled"})`,
  });

  return ok(undefined, "Referral settings saved.");
}
