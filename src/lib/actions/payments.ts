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
  screenshotPath: string; resumeService?:string;
}): Promise<ActionResult<{id:string}>> {
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

  if (!["BDT", "USD"].includes(user.currency)) return fail("No BDT exchange rate is configured for this wallet.");
  const screenshotUrl = input.screenshotPath;
  const [owner, file, ...rest] = (screenshotUrl ?? "").split("/");
  if (owner !== user.id || rest.length || !/^[a-f0-9-]{36}\.(png|jpeg|gif|webp)$/.test(file ?? "")) {
    return fail("Upload a valid payment screenshot.");
  }
  const proof = await supabase.storage.from(BUCKET).info(screenshotUrl);
  const size = Number(proof.data?.size ?? proof.data?.metadata?.size);
  const mime = proof.data?.contentType ?? proof.data?.metadata?.mimetype;
  if (proof.error || !size || size > MAX_SIZE || !ALLOWED_TYPES.has(String(mime))) {
    return fail("Payment screenshot is missing or invalid.");
  }

  const resumeService=input.resumeService&&/^[a-f0-9-]{36}$/i.test(input.resumeService)?input.resumeService:null;
  const draft=resumeService?(await supabase.from("customer_settings").select("value").eq("user_id",user.id).eq("key","draft:"+resumeService).maybeSingle()).data?.value:null;
  const { data: payment, error: insertError } = await supabase
    .from("payment_requests")
    .insert({
      id: file.split(".")[0],
      user_id: user.id,
      method: parsed.data.method,
      sender_number: parsed.data.senderNumber,
      amount: parsed.data.amount,
      currency: "BDT",
      transaction_id: parsed.data.transactionId,
      resume_service:resumeService,resume_draft:draft,screenshot_url:screenshotUrl,
      note: parsed.data.note || null,
      status: "pending",
    })
    .select("*")
    .single();

  if (insertError?.code === "23505") {
    const existing=await supabase.rpc("my_payment_reference",{p_method:parsed.data.method,p_tx:parsed.data.transactionId});
    if(existing.data)return ok({id:existing.data},"Payment already recorded.");
    return fail("Payment reference unavailable. Contact support.");
  }
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

  return ok({id:payment.id}, "Payment request submitted. Awaiting approval.");
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
