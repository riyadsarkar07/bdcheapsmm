"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  Send,
  Lock,
  Unlock,
  Shield,
  User,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TicketStatusBadge } from "@/components/status-badges";
import {
  closeTicketAction,
  reopenTicketAction,
  replyTicketAction,
} from "@/lib/actions/tickets";
import { formatDateTime, getInitials } from "@/lib/utils";
import type { Ticket, TicketMessage, TicketStatus } from "@/lib/types/database";

interface MessageWithUser extends TicketMessage {
  profiles?: { id: string; full_name: string | null; email: string | null; avatar_url: string | null } | null;
}

export function TicketThread({
  ticket,
  isAdmin,
}: {
  ticket: Ticket;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [messages, setMessages] = React.useState<MessageWithUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [status, setStatus] = React.useState<TicketStatus>(ticket.status);

  React.useEffect(() => {
    let mounted = true;

    async function load() {
      const { data } = await supabase
        .from("ticket_messages")
        .select("*, profiles(id, full_name, email, avatar_url)")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });
      if (!mounted) return;
      setMessages((data ?? []) as MessageWithUser[]);
      setLoading(false);
    }

    void load();

    const channel = supabase
      .channel(`ticket-${ticket.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_messages",
          filter: `ticket_id=eq.${ticket.id}`,
        },
        async (payload) => {
          const newMessage = payload.new as MessageWithUser;
          const { data: sender } = await supabase
            .from("profiles")
            .select("id, full_name, email, avatar_url")
            .eq("id", newMessage.user_id)
            .maybeSingle();
          setMessages((prev) => [...prev, { ...newMessage, profiles: sender }]);
          // Auto-refresh status when admin replies
          if (newMessage.is_staff) {
            setStatus("open");
            router.refresh();
          } else {
            setStatus("waiting");
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, ticket.id, router]);

  async function sendReply() {
    const text = message.trim();
    if (!text) return;
    setSending(true);
    try {
      const result = await replyTicketAction({ ticketId: ticket.id, message: text });
      if (result.success) {
        setMessage("");
      } else {
        toast.error(result.error ?? "Failed to send");
      }
    } finally {
      setSending(false);
    }
  }

  async function toggleClose() {
    const result =
      status === "closed"
        ? await reopenTicketAction(ticket.id)
        : await closeTicketAction(ticket.id);
    if (result.success) {
      setStatus(status === "closed" ? "open" : "closed");
      toast.success(result.message ?? "Updated");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-3xl space-y-4"
    >
      <div className="glass-card rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold">#{ticket.ticket_number}</h1>
              <TicketStatusBadge status={status} />
              <Badge variant="subtle">{ticket.priority}</Badge>
            </div>
            <p className="mt-1 font-medium">{ticket.subject}</p>
            <p className="text-xs text-muted-foreground">
              Opened {formatDateTime(ticket.created_at)}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={toggleClose}>
            {status === "closed" ? (
              <>
                <Unlock /> Reopen
              </>
            ) : (
              <>
                <Lock /> Close Ticket
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="glass-card flex flex-col gap-3 rounded-xl p-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No messages yet.
          </p>
        ) : (
          messages.map((msg) => {
            const isStaffMsg = msg.is_staff;
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isStaffMsg ? "flex-row" : "flex-row-reverse"}`}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={msg.profiles?.avatar_url ?? undefined} />
                  <AvatarFallback>
                    {getInitials(msg.profiles?.full_name ?? "Support")}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                    isStaffMsg
                      ? "rounded-tl-sm border bg-background"
                      : "rounded-tr-sm gradient-bg text-white"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-1.5 text-xs">
                    {isStaffMsg ? (
                      <>
                        <Shield className="h-3 w-3 text-primary" />
                        <span className="font-semibold">
                          {msg.profiles?.full_name ?? "Support Staff"}
                        </span>
                      </>
                    ) : (
                      <>
                        <User className="h-3 w-3 opacity-80" />
                        <span className="font-semibold opacity-90">
                          {msg.profiles?.full_name ?? "You"}
                        </span>
                      </>
                    )}
                    <span className="ml-1 opacity-60">
                      {formatDateTime(msg.created_at, "MMM d, h:mm a")}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{msg.message}</p>
                  {msg.attachment_url ? (
                    <a
                      href={msg.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline"
                    >
                      <Paperclip className="h-3 w-3" /> Attachment
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {status !== "closed" ? (
        <div className="glass-card rounded-xl p-4">
          <Textarea
            placeholder="Type your reply..."
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {isAdmin ? "Replying as staff" : "Our team usually replies within a few hours."}
            </p>
            <Button onClick={sendReply} disabled={sending || !message.trim()}>
              {sending ? <Loader2 className="animate-spin" /> : <Send />}
              Send Reply
            </Button>
          </div>
        </div>
      ) : (
        <p className="rounded-xl border p-4 text-center text-sm text-muted-foreground">
          This ticket is closed.
        </p>
      )}
    </motion.div>
  );
}
