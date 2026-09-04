import { NextResponse } from "next/server";
import { requireUser, isAdminProfile } from "@/lib/guards";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractPaymentProofPath } from "@/lib/supabase/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { user, error } = await requireUser();
  if (error || !user) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: payment } = await supabase
    .from("payment_requests")
    .select("id, user_id, screenshot_url")
    .eq("id", id)
    .maybeSingle();

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }
  if (payment.user_id !== user.id && !isAdminProfile(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const path = extractPaymentProofPath(payment.screenshot_url);
  if (!path) {
    return NextResponse.json({ error: "Screenshot not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error: downloadError } = await admin.storage
    .from("payment-proofs")
    .download(path);

  if (downloadError || !data) {
    return NextResponse.json({ error: "Screenshot not found" }, { status: 404 });
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const contentType = data.type || "image/png";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=60",
    },
  });
}
