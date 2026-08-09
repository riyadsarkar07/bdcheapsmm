import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/guards";
import { TicketThread } from "@/components/support/ticket-thread";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, error } = await requireUser();
  if (error || !user) return null;

  const supabase = await createClient();
  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!ticket) notFound();
  if (ticket.user_id !== user.id && user.role !== "admin") notFound();

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/support">
          <ArrowLeft /> Back to support
        </Link>
      </Button>
      <TicketThread ticket={ticket} isAdmin={user.role === "admin"} />
    </div>
  );
}
