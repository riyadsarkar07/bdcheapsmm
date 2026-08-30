import { NextResponse } from "next/server";
import { requireUser, isAdminProfile } from "@/lib/guards";
import { createClient } from "@/lib/supabase/server";
import { getPublicSettings } from "@/lib/settings";
import { generateDepositInvoicePdf } from "@/lib/invoice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stream a PDF invoice for an approved Add Funds deposit. Only the payment
 * owner or an active admin may download it, and only when the payment request
 * is approved — pending or rejected payments never get an invoice. The PDF is
 * generated read-only from the existing payment_requests row and never writes
 * to or duplicates any payment/transaction/balance data.
 */
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
    .select("id, user_id, method, transaction_id, amount, currency, status, created_at, processed_at")
    .eq("id", id)
    .maybeSingle();

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }
  if (payment.user_id !== user.id && !isAdminProfile(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (payment.status !== "approved") {
    return NextResponse.json(
      { error: "Invoice is only available for approved deposits." },
      { status: 403 }
    );
  }

  // payment_requests has two FKs to profiles (user_id, processed_by), so the
  // profiles(...) embed is ambiguous. Fetch the bill-to profile separately.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", payment.user_id)
    .maybeSingle();

  const settings = await getPublicSettings();

  const pdf = await generateDepositInvoicePdf({
    invoiceNumber: `DEP-${payment.id.slice(0, 8).toUpperCase()}`,
    payment: {
      method: payment.method,
      transaction_id: payment.transaction_id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      created_at: payment.created_at,
      processed_at: payment.processed_at,
    },
    profile: {
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
    },
    panel: settings.site,
    timezone: settings.general.timezone,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${payment.id}.pdf"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
