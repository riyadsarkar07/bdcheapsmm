"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Headphones, Inbox } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { TicketStatusBadge } from "@/components/status-badges";
import { timeAgo, getInitials } from "@/lib/utils";
import type { TicketStatus } from "@/lib/types/database";

type TicketRow = {
  id: string;
  ticket_number: string;
  subject: string;
  status: TicketStatus;
  priority: string;
  category: string | null;
  last_message_at: string;
  created_at: string;
  profiles?: { full_name: string | null; email: string | null; avatar_url: string | null } | null;
};

export function AdminSupport({ tickets }: { tickets: TicketRow[] }) {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");

  const filtered = tickets.filter((t) => {
    const matchesSearch =
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
      (t.profiles?.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (t.profiles?.full_name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openCount = tickets.filter((t) => t.status !== "closed").length;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({tickets.length})</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="waiting">Waiting</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Inbox className="h-3.5 w-3.5" />
        {openCount} open ticket{openCount === 1 ? "" : "s"} need attention
      </p>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <EmptyState icon={Headphones} title="No tickets found" />
        ) : (
          filtered.map((ticket) => (
            <Link key={ticket.id} href={`/admin/support/${ticket.id}`}>
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex items-center gap-4 p-4">
                  <Avatar className="hidden h-9 w-9 shrink-0 sm:flex">
                    <AvatarImage src={ticket.profiles?.avatar_url ?? undefined} />
                    <AvatarFallback>{getInitials(ticket.profiles?.full_name ?? "U")}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">#{ticket.ticket_number}</span>
                      <TicketStatusBadge status={ticket.status} />
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                        {ticket.priority}
                      </span>
                      {ticket.category ? (
                        <span className="hidden rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground sm:inline">
                          {ticket.category}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-1 font-medium">{ticket.subject}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {ticket.profiles?.full_name ?? "User"} · {ticket.profiles?.email} · last reply {timeAgo(ticket.last_message_at)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
