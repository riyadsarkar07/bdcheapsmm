import { NextResponse } from "next/server";
import { requireUser, isAdminProfile } from "@/lib/guards";
import { createClient } from "@/lib/supabase/server";
import { getPublicSettings } from "@/lib/settings";
import { generateOrderInvoicePdf } from "@/lib/invoice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stream a PDF invoice for an order. Only the order owner or an active admin
 * may download it. The PDF is generated on the fly from existing order data and
 * never writes to or duplicates any database records.
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
  const { data: order } = await supabase
    .from("orders")
    .select("*, services(id, name), profiles(full_name, email)")
    .eq("id", id)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.user_id !== user.id && !isAdminProfile(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await getPublicSettings();

  const pdf = await generateOrderInvoicePdf({
    order: {
      order_number: order.order_number,
      link: order.link,
      quantity: order.quantity,
      price: order.price,
      status: order.status,
      provider_order_id: order.provider_order_id,
      created_at: order.created_at,
    },
    serviceName: order.services?.name ?? null,
    profile: {
      full_name: order.profiles?.full_name ?? null,
      email: order.profiles?.email ?? null,
    },
    panel: settings.site,
    timezone: settings.general.timezone,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${order.order_number}.pdf"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
