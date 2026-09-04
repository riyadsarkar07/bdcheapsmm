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
    const path = (url.pathname.replace(/\/+$/, "") || "/").toLowerCase();
    return { host, path, href: `${url.protocol}//${host}${path}${url.search}` };
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
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, status, quantity, created_at, link, service_id, services(name)")
    .eq("user_id", user.id)
    .in("status", [...ACTIVE_STATUSES])
    .limit(80);

  const conflicts: UrlConflict[] = (orders ?? [])
    .filter((order) => {
      const other = normalizeUrl(order.link);
      if (!other) return order.link.trim() === input.link.trim();
      return other.host === parsed.host && other.path === parsed.path;
    })
    .map((order) => ({
      orderId: order.id,
      orderNumber: order.order_number,
      status: order.status,
      quantity: order.quantity,
      serviceName: order.services?.name ?? null,
      createdAt: order.created_at,
    }));

  return ok({ conflicts });
}
