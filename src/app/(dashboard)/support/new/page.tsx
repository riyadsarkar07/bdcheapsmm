import { requireUser } from "@/lib/guards";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { NewTicketForm } from "@/components/support/new-ticket-form";

export const metadata: Metadata = {
  title: "New Ticket",
};

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  if (!order) return <NewTicketForm />;
  const { user } = await requireUser();
  if (!user) notFound();
  const db = await createClient();
  const { data } = await db.from("orders").select("id,order_number,services(name)")
    .eq("id", order).eq("user_id", user.id).maybeSingle();
  if (!data) notFound();
  return <NewTicketForm orderId={data.id} subject={`Order #${data.order_number} — ${data.services?.name ?? "Service"}`.slice(0,200)} />;
}
