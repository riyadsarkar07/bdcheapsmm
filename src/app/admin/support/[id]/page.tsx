import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/guards";
import { TicketThread } from "@/components/support/ticket-thread";
import { notFound } from "next/navigation";

export const revalidate = 0;

export default async function AdminSupportTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, error } = await requireAdmin();
  if (error || !user) return null;

  const { id } = await params;
  const supabase = await createClient();
  const { data: ticket } = await supabase.from("tickets").select("*").eq("id", id).single();

  if (!ticket) notFound();

  return <TicketThread ticket={ticket} isAdmin />;
}
