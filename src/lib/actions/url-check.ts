"use server";

import { fail, ok, requireUser, type ActionResult } from "@/lib/guards";

const ACTIVE_STATUSES = ["pending", "processing", "in_progress", "partial"] as const;

export type UrlConflict = {
  orderId: string;
  orderNumber: string;
  status: string;
  quantity: number;
  serviceName: string | null;
  createdAt: string;
};

function normalizeUrl(raw: string): { host: string; path: string; href: string } | null {
  try {
    const url = new URL(raw.trim());
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    const path = url.pathname.replace(/\/+$/, "") || "/";
    for (const key of Array.from(url.searchParams.keys())) {
      if (/^(utm_|fbclid$|igsh$)/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return { host, path, href: `${host}${path}${url.search}` };
  } catch {
    return null;
  }
}

export async function checkUrlConflictAction(input: {
  link: string;
  serviceId?: string;
}): Promise<ActionResult<{ conflicts: UrlConflict[] }>> {
  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");

  const parsed = normalizeUrl(input.link);
  if (!parsed) return ok({ conflicts: [] });

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const conflicts: UrlConflict[] = [];
  for (let offset = 0; ; offset += 200) {
    let query = supabase.from("orders")
      .select("id,order_number,status,quantity,created_at,link,services(name)")
      .eq("user_id", user.id).in("status", [...ACTIVE_STATUSES]);
    if (input.serviceId) query = query.eq("service_id", input.serviceId);
    const {data,error} = await query.order("id").range(offset, offset+199);
    if (error) return fail("Could not check active orders");
    for (const order of data) {
      if (normalizeUrl(order.link)?.href === parsed.href) {
        conflicts.push({orderId:order.id,orderNumber:order.order_number,status:order.status,
          quantity:order.quantity,serviceName:order.services?.name ?? null,createdAt:order.created_at});
      }
    }
    if (data.length < 200 || conflicts.length >= 10) break;
  }
  return ok({ conflicts });
}
