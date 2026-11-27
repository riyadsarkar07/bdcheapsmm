import Link from "next/link";
import {CustomerText} from "@/components/customer-language";
import { DropReport } from "@/components/support/drop-report";
import { requireUser } from "@/lib/guards";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { NewTicketForm } from "@/components/support/new-ticket-form";

export const metadata: Metadata = {
  title: "New Ticket",
};

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<{ order?: string; drop?:string;issue?:string }> }) {
  const { order, drop,issue } = await searchParams;
  if (!order) return <><nav className="glass-card mx-auto mb-4 flex max-w-2xl flex-wrap gap-3 p-4 text-primary"><Link href="/orders"><CustomerText value="Follower drop or delayed order"/></Link><Link href="/support/new?issue=deposit"><CustomerText value="Missing deposit"/></Link><Link href="/support"><CustomerText value="My support tickets"/></Link></nav><NewTicketForm key={issue||"default"} subject={issue==="deposit"?"Missing deposit":""} category={issue==="deposit"?"Payment":""} message={issue==="deposit"?"Transaction ID / লেনদেন আইডি: ":""}/></>;
  const { user } = await requireUser();
  if (!user) notFound();
  const db = await createClient();
  const { data } = await db.from("orders").select("id,order_number,provider_order_id,services(name)")
    .eq("id", order).eq("user_id", user.id).maybeSingle();
  if (!data) notFound();
  const {data:tickets}=await db.from("tickets").select("id,subject").eq("user_id",user.id).neq("status","closed").ilike("subject","%#"+data.order_number+"%").limit(5);
  const existing=tickets?.map(v=><Link className="mb-2 block text-primary underline" key={v.id} href={"/support/"+v.id}><CustomerText value="Continue open ticket"/> · {v.subject}</Link>);
  if (drop === "1") return <>{existing}<DropReport order={data.id} number={data.order_number} provider={data.provider_order_id} userId={user.id} /></>;
  return <>{existing}<NewTicketForm orderId={data.id} subject={`Order #${data.order_number} — ${data.services?.name ?? "Service"}`.slice(0,200)} /></>;
}
