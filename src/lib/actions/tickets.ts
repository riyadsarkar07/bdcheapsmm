"use server";

import { headers } from "next/headers";
import { createTicketSchema, replyTicketSchema } from "@/lib/validations";
import { fail, ok, requireUser, isAdminProfile, type ActionResult } from "@/lib/guards";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { generateTicketNumber } from "@/lib/utils";
import { writeLog } from "@/lib/audit";

export async function createTicketAction(input: {
  subject: string;
  category?: string;
  priority: string;
  message: string;
}): Promise<ActionResult<{ ticketId: string }>> {
  const headerStore = await headers();
  const ip = getClientIp(headerStore);

  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");

  const limited = await rateLimit(`ticket:${user.id}`, 10, 3600);
  if (!limited.success) return fail("Too many tickets created. Please wait.");

  const parsed = createTicketSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid ticket data");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const ticketNumber = generateTicketNumber();

  const { data: ticket, error: ticketError } = await supabase.rpc(
    "create_ticket_with_message",
    {
      p_ticket_number: ticketNumber,
      p_subject: parsed.data.subject,
      p_priority: parsed.data.priority,
      p_category: parsed.data.category || null,
      p_message: parsed.data.message,
    }
  );

  if (ticketError || !ticket) return fail("Failed to create ticket.");

  // The `notify_ticket_reply` trigger notifies all admins on the first message,
  // so no manual broadcast is needed here.

  await writeLog({
    userId: user.id,
    action: "create",
    entityType: "tickets",
    entityId: ticket.id,
    description: `Opened ticket #${ticket.ticket_number}`,
    ip,
    userAgent: headerStore.get("user-agent"),
  });

  return ok({ ticketId: ticket.id });
}

export async function replyTicketAction(input: {
  ticketId: string;
  message: string;
  isStaff?: boolean;
}): Promise<ActionResult> {
  const headerStore = await headers();
  const ip = getClientIp(headerStore);

  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");

  const limited = await rateLimit(`ticketmsg:${user.id}`, 30, 300);
  if (!limited.success) return fail("You are replying too quickly.");

  const parsed = replyTicketSchema.safeParse({ message: input.message });
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid message");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .select("id, user_id, status")
    .eq("id", input.ticketId)
    .single();

  if (ticketError || !ticket) return fail("Ticket not found.");
  if (ticket.user_id !== user.id && !isAdminProfile(user)) return fail("Forbidden.");
  if (ticket.status === "closed") return fail("This ticket is closed.");

  const isStaff = isAdminProfile(user);
  const { error: msgError } = await supabase.rpc("create_ticket_message", {
    p_ticket_id: ticket.id,
    p_message: parsed.data.message,
    p_is_staff: isStaff,
  });

  if (msgError) return fail("Failed to send message.");

  if (isStaff) {
    await writeLog({
      userId: user.id,
      action: "update",
      entityType: "tickets",
      entityId: ticket.id,
      description: "Replied to ticket",
      ip,
      userAgent: headerStore.get("user-agent"),
    });
  }

  return ok(undefined, "Message sent.");
}

export async function closeTicketAction(ticketId: string): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, user_id")
    .eq("id", ticketId)
    .single();

  if (!ticket) return fail("Ticket not found.");
  if (ticket.user_id !== user.id && !isAdminProfile(user)) return fail("Forbidden.");

  await supabase.from("tickets").update({ status: "closed" }).eq("id", ticketId);
  return ok(undefined, "Ticket closed.");
}

export async function reopenTicketAction(ticketId: string): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");
  if (!isAdminProfile(user)) return fail("Forbidden.");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.from("tickets").update({ status: "open" }).eq("id", ticketId);
  return ok(undefined, "Ticket reopened.");
}
