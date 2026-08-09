"use server";

import { headers } from "next/headers";
import { updateProfileSchema } from "@/lib/validations";
import { fail, ok, requireUser, type ActionResult } from "@/lib/guards";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { writeLog } from "@/lib/audit";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

export async function updateProfileAction(input: {
  fullName: string;
  phone?: string;
  country?: string;
  currency?: string;
  timezone?: string;
}): Promise<ActionResult> {
  const headerStore = await headers();
  const ip = getClientIp(headerStore);

  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");

  const limited = await rateLimit(`profile:${user.id}`, 20, 300);
  if (!limited.success) return fail("Too many requests. Slow down.");

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.errors[0]?.message ?? "Invalid profile data");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone || null,
      country: parsed.data.country || null,
      currency: parsed.data.currency,
      timezone: parsed.data.timezone,
    })
    .eq("id", user.id);

  if (updateError) return fail("Failed to update profile.");

  await writeLog({
    userId: user.id,
    action: "update",
    entityType: "profiles",
    entityId: user.id,
    description: "Updated profile",
    ip,
    userAgent: headerStore.get("user-agent"),
  });

  return ok(undefined, "Profile updated.");
}

export async function uploadAvatarAction(input: {
  data: string;
  type: string;
  size: number;
}): Promise<ActionResult<{ url: string }>> {
  const headerStore = await headers();
  const ip = getClientIp(headerStore);

  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");

  if (input.size > MAX_AVATAR_SIZE) return fail("Avatar must be smaller than 2MB.");
  if (!["image/png", "image/jpeg", "image/webp"].includes(input.type)) {
    return fail("Avatar must be PNG, JPEG or WEBP.");
  }

  const base64 = input.data.replace(/^data:.*?;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength > MAX_AVATAR_SIZE) return fail("Avatar must be smaller than 2MB.");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const ext = input.type.split("/")[1] ?? "png";
  const path = `${user.id}-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, buffer, { contentType: input.type, upsert: true });
  if (uploadError) return fail("Failed to upload avatar.");

  const url = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;

  await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  await writeLog({
    userId: user.id,
    action: "update",
    entityType: "profiles",
    entityId: user.id,
    description: "Updated avatar",
    ip,
    userAgent: headerStore.get("user-agent"),
  });

  return ok({ url }, "Avatar updated.");
}

export async function updateNotificationsReadAction(ids: string[]): Promise<void> {
  const { user } = await requireUser();
  if (!user || ids.length === 0) return;
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.from("notifications").update({ is_read: true }).in("id", ids).eq("user_id", user.id);
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const { user } = await requireUser();
  if (!user) return;
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
}
