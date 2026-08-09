"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Loader2, Send, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { createTicketAction } from "@/lib/actions/tickets";

const formSchema = z.object({
  subject: z.string().min(3, "Subject is required").max(200),
  category: z.string().max(100).optional().or(z.literal("")),
  priority: z.enum(["low", "normal", "high"]),
  message: z.string().min(5, "Please describe your issue").max(5000),
});

export function NewTicketForm() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { subject: "", category: "", priority: "normal", message: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      const result = await createTicketAction(values);
      if (result.success && result.data) {
        toast.success("Ticket created!");
        router.push(`/support/${result.data.ticketId}`);
      } else {
        toast.error(result.error ?? "Failed to create ticket");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-2xl"
    >
      <div className="glass-card rounded-xl p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl gradient-bg text-white shadow-lg">
            <Headphones className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Open a Support Ticket</h1>
            <p className="text-sm text-muted-foreground">
              We usually reply within a few hours.
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Order not delivered" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Payment, Order, Refund" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        {...field}
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe your issue in detail. Include order IDs if relevant."
                      rows={6}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" variant="gradient" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Send />}
              Submit Ticket
            </Button>
          </form>
        </Form>
      </div>
    </motion.div>
  );
}
