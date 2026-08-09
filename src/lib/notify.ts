import type { NotificationType } from "@/lib/types/database";

interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}

/**
 * Insert a notification. Uses the security-definer `create_notification` RPC
 * so notifications can be created for any user (e.g. admins notifying a user,
 * or a user notifying themselves) regardless of RLS on the notifications table.
 */
export async function createNotification(input: NotificationInput): Promise<void> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.rpc("create_notification", {
    p_user_id: input.userId,
    p_type: input.type,
    p_title: input.title,
    p_body: input.body ?? null,
    p_link: input.link ?? null,
  });
}

export async function notifyAllAdmins(input: Omit<NotificationInput, "userId">): Promise<void> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: admins } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin");
  if (!admins || admins.length === 0) return;
  for (const admin of admins) {
    await supabase.rpc("create_notification", {
      p_user_id: admin.id,
      p_type: input.type,
      p_title: input.title,
      p_body: input.body ?? null,
      p_link: input.link ?? null,
    });
  }
}
