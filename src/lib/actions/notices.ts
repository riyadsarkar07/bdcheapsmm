"use server";

import { fail, ok, requireUser, type ActionResult } from "@/lib/guards";
import type { Notice } from "@/lib/types/database";

export async function markNoticeReadAction(noticeId: string): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error: insertError } = await supabase.from("notice_reads").upsert(
    { notice_id: noticeId, user_id: user.id },
    { onConflict: "notice_id,user_id" }
  );
  if (insertError) return fail(insertError.message);
  return ok();
}

export async function markAllNoticesReadAction(): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: notices } = await supabase
    .from("notices")
    .select("id")
    .eq("is_published", true);

  const rows = (notices ?? []).map((n: Pick<Notice, "id">) => ({
    notice_id: n.id,
    user_id: user.id,
  }));
  if (rows.length === 0) return ok();

  const { error: insertError } = await supabase
    .from("notice_reads")
    .upsert(rows, { onConflict: "notice_id,user_id" });
  if (insertError) return fail(insertError.message);
  return ok();
}
