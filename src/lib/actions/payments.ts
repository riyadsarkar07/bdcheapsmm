"use server";

import { headers } from "next/headers";
import { addFundsSchema } from "@/lib/validations";
import { fail, ok, requireUser, type ActionResult } from "@/lib/guards";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { writeLog } from "@/lib/audit";
import type { PaymentStatus } from "@/lib/types/database";

const BUCKET = "payment-proofs";
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_SIZE = 5 * 1024 * 1024;

export async function submitPaymentAction(input: {
  method: string;
  senderNumber: string;
  amount: number;
  transactionId: string;
  note?: string;
  screenshot?: string;
  screenshotName?: string;
  screenshotType?: string;
  screenshotSize?: number;
}): Promise<ActionResult> {
  const headerStore = await headers();
  const ip = getClientIp(headerStore);

  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");

  const limited = await rateLimit(`payment:${user.id}`, 10, 3600);
  if (!limited.success) {
    return fail("You have submitted too many payment requests. Please wait.");
  }

  const parsed = addFundsSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.errors[0]?.message ?? "Invalid payment data");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  let screenshotUrl: string | null = null;

  if (input.screenshot) {
    if (input.screenshotSize && input.screenshotSize > MAX_SIZE) {
      return fail("Screenshot must be smaller than 5MB.");
    }
    if (input.screenshotType && !ALLOWED_TYPES.has(input.screenshotType)) {
      return fail("Screenshot must be PNG, JPEG, WEBP or GIF.");
    }
    const base64 = input.screenshot.replace(/^data:.*?;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    if (buffer.byteLength > MAX_SIZE) {
      return fail("Screenshot must be smaller than 5MB.");
    }
    const ext = (input.screenshotType ?? "image/png").split("/")[1] ?? "png";
    const fileName = `${user.id}-${Date.now()}.${ext}`;
    const { data: uploaded, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(`payments/${fileName}`, buffer, {
        contentType: input.screenshotType ?? "image/png",
        upsert: false,
      });
    if (uploadError || !uploaded) {
      return fail("Failed to upload screenshot. Please try again.");
    }
    // Store the object path (bucket is private). Signed URLs are resolved
    // server-side when the payment request is displayed.
    screenshotUrl = uploaded.path;
  }

  const { data: payment, error: insertError } = await supabase
    .from("payment_requests")
    .insert({
      user_id: user.id,
      method: parsed.data.method,
      sender_number: parsed.data.senderNumber,
      amount: parsed.data.amount,
      currency: user.currency,
      transaction_id: parsed.data.transactionId,
      screenshot_url: screenshotUrl,
      note: parsed.data.note || null,
      status: "pending",
    })
    .select("*")
    .single();

  if (insertError || !payment) {
    return fail(
      insertError
        ? `Failed to submit payment request: ${insertError.message}`
        : "Failed to submit payment request."
    );
  }

  await writeLog({
    userId: user.id,
    action: "create",
    entityType: "payment_requests",
    entityId: payment.id,
    description: `Submitted ${payment.method} deposit request for ${payment.amount} ${payment.currency}`,
    ip,
    userAgent: headerStore.get("user-agent"),
  });

  return ok(undefined, "Payment request submitted. Awaiting approval.");
}

export async function getMyPaymentRequestsAction(): Promise<ActionResult<unknown[]>> {
  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_requests")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return ok(data ?? []);
}

export type { PaymentStatus };
