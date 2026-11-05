import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TicketStatusBadge } from "@/components/status-badges";
import Link from "next/link";
import { Plus, Headphones, ChevronRight, MessageSquare } from "lucide-react";
import { formatDateTime, timeAgo } from "@/lib/utils";
import type { TicketStatus } from "@/lib/types/database";

export const revalidate = 0;

export default async function SupportPage() {
  const { user, error } = await requireUser();
  if (error || !user) return null;

  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from("tickets")
    .select("id, ticket_number, subject, status, priority, last_message_at, created_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <div>
      <PageHeader
        eyebrow="Help"
        title="Support"
        description="Open a ticket and our team will get back to you."
        icon={<Headphones />}
      >
        <Button asChild variant="gradient">
          <Link href="/support/new">
            <Plus /> New Ticket
          </Link>
        </Button>
      </PageHeader>

      {(tickets ?? []).length === 0 ? (
        <EmptyState
          icon={Headphones}
          title="No support tickets"
          description="If you need help, create a ticket and we'll respond shortly."
          action={
            <Button asChild variant="gradient">
              <Link href="/support/new">
                <Plus /> Open a Ticket
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {(tickets ?? []).map((ticket) => (
            <Link key={ticket.id} href={`/support/${ticket.id}`} className="block">
              <Card className="card-interactive">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex">
                      <MessageSquare className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">#{ticket.ticket_number}</span>
                        <TicketStatusBadge status={ticket.status as TicketStatus} />
                        <Badge variant="subtle" className="capitalize">
                          {ticket.priority}
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-1 font-medium">{ticket.subject}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Last reply {timeAgo(ticket.last_message_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      {formatDateTime(ticket.created_at, "MMM d, yyyy")}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
