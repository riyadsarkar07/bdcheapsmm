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
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
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
