import type { Metadata } from "next";
import { NewTicketForm } from "@/components/support/new-ticket-form";

export const metadata: Metadata = {
  title: "New Ticket",
};

export default function NewTicketPage() {
  return <NewTicketForm />;
}
