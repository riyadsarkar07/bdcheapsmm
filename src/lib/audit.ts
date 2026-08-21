import type { Json, LogAction } from "@/lib/types/database";

interface LogInput {
  userId: string | null;
  action: LogAction;
  entityType?: string | null;
  entityId?: string | null;
  description?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Json;
}

export async function writeLog(input: LogInput): Promise<void> {
  // The logs table only allows admin access under RLS, so use the service-role
  // client to guarantee the entry is persisted for every user.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  await supabase.from("logs").insert({
    user_id: input.userId,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    description: input.description ?? null,
    ip: input.ip ?? null,
    user_agent: input.userAgent ?? null,
    meta: input.meta ?? {},
  });
}
