"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, requireUser, type ActionResult } from "@/lib/guards";
import { rateLimit } from "@/lib/rate-limit";
import { helpFeedbackSchema } from "@/lib/validations";

export async function submitHelpFeedbackAction(input: {
  articleId: string;
  helpful: boolean;
}): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");

  const limited = await rateLimit(`help-feedback:${user.id}`, 30, 60);
  if (!limited.success) return fail("Too many votes. Please wait.");

  const parsed = helpFeedbackSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid feedback");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error: upsertError } = await supabase.from("help_article_feedback").upsert(
    {
      article_id: parsed.data.articleId,
      user_id: user.id,
      helpful: parsed.data.helpful,
    },
    { onConflict: "article_id,user_id" }
  );

  if (upsertError) {
    if (upsertError.message.toLowerCase().includes("help_article")) {
      return fail("Help Center storage is not available yet.");
    }
    return fail(upsertError.message);
  }

  revalidatePath("/help-center");
  return ok(undefined, parsed.data.helpful ? "Thanks for the feedback." : "Thanks — we will improve this article.");
}
