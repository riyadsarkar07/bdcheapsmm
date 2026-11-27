import {DeliveryReceipt} from "@/components/orders/delivery-receipt";
import {saveOrderNote} from "@/lib/actions/customer-tools";
import { CustomerText } from "@/components/customer-language";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refillTerms } from "@/lib/refill-terms";
import {dhakaTime} from "@/lib/customer-order";
import {formatUsd, formatCurrency} from "@/lib/utils";
import { requireUser, isAdminProfile } from "@/lib/guards";
import { computeOrderProfit } from "@/lib/order-profit";
import { OrderDetailClient } from "@/components/orders/order-detail-client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const maxDuration = 60;

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, error } = await requireUser();
  if (error || !user) return null;

  const isAdmin = isAdminProfile(user);
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      isAdmin
        ? "*, services(id, name, slug, meta, description, type, provider_price), profiles(full_name, email)"
        : "*, services(id, name, slug, meta, description, type), profiles(full_name, email)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();
  if (order.user_id !== user.id && !isAdmin) notFound();

  const { data: provider } = order.provider_id
    ? await supabase
        .from("providers")
        .select("id, name")
        .eq("id", order.provider_id)
        .maybeSingle()
    : { data: null };

  const terms = refillTerms(order.services?.meta, order.services?.name, order.services?.description ?? "");
  const [events, credits, reports,note,debits] = await Promise.all([
    createAdminClient().from("logs").select("id,created_at,description,action,submitted:meta->>provider_submitted,reference:meta->>provider_order_id").eq("entity_type", "orders")
      .eq("entity_id", id).in("action", ["order_create","order_refill", "order_cancel"]).order("created_at"),
    supabase.from("transactions").select("id,created_at,amount,currency").eq("user_id", order.user_id)
      .eq("reference_id", id).eq("reference_type", "orders").eq("type", "refund"),
    supabase.from("order_drop_reports").select("ticket_id,created_at").eq("order_id",id),
    supabase.from("order_notes").select("note").eq("order_id",id).maybeSingle(),
    supabase.from("transactions").select("amount,currency").eq("user_id",order.user_id).eq("reference_type","orders").eq("reference_id",id).eq("type","order_deduction"),
  ]);
  const snapshot = order.provider_response && typeof order.provider_response === "object" && !Array.isArray(order.provider_response) ? order.provider_response : {};
  const purchased=order.checkout_terms && typeof order.checkout_terms==="object" && !Array.isArray(order.checkout_terms) ? order.checkout_terms : null;
  const cancellations=(events.data??[]).filter(e=>e.action==="order_cancel");
  const request=cancellations.filter(e=>e.description==="Provider cancellation requested.").at(-1);
  const reply=cancellations.filter(e=>(!request || e.created_at>=request.created_at) &&
    (e.description?.includes("acknowledged cancellation request") || e.description==="Provider declined the cancellation request." ||
     e.description==="Cancellation request sent; provider receipt unconfirmed.")).at(-1);
  const finalStatus=typeof snapshot.status==="string" && ["cancelled","canceled","refunded"].includes(snapshot.status.trim().toLowerCase()) ? snapshot.status : null;
  const refundStarted=!!(request||reply||finalStatus||credits.data?.length||order.cancel_count||order.status==="refunded");
  const history = [
    { id:"placed", created_at:order.created_at, text:"Order placed", href:"" },
    ...(typeof snapshot.status === "string" && typeof snapshot.panel_checked_at === "string" ? [
      {id:"provider-status", created_at:snapshot.panel_checked_at, text:snapshot.status, href:"", provider:true}
    ] : []),
    ...(reports.data ?? []).map(r => ({id:r.ticket_id, created_at:r.created_at, text:"Follower drop reported", href:(isAdmin ? "/admin/support/" : "/support/") + r.ticket_id})),
    ...(events.data ?? []).filter(e => e.action !== "order_create" || (e.submitted === "true" && e.reference && e.reference === order.provider_order_id))
      .map(e => ({id:e.id, created_at:e.created_at, href:"", text:e.action === "order_create" ? "Provider acknowledged order" : e.description ?? ""})),
    ...(credits.data ?? []).map(e => ({ ...e, href:"", text: "Wallet credited " + formatCurrency(e.amount, e.currency) })),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at));

  const profit = isAdmin
    ? computeOrderProfit(order, order.services as { provider_price?: number | null } | null)
    : undefined;

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/orders">
          <ArrowLeft /> Back to orders
        </Link>
      </Button>
      <OrderDetailClient
        refillLabel={terms.label}
        refillDisabled={terms.disabled}
        order={order}
        providerName={isAdmin ? provider?.name ?? null : null}
        isOwner={user.id === order.user_id}
        isAdmin={isAdmin}
        profit={profit}
      />
      <section className="glass-card mt-4 min-w-0 space-y-2 p-4 text-sm">
        <h2 className="font-semibold"><CustomerText value="Terms at purchase"/></h2>
        {purchased ? <>
          <p className="break-words">{String(purchased.service)}</p>
          <p><CustomerText value="Rate per 1,000"/> · {formatUsd(Number(purchased.rate_usd),6)}</p>
          <p><CustomerText value="Quantity"/> · {String(purchased.quantity)} · <CustomerText value="Price"/> · {formatCurrency(Number(purchased.price),String(purchased.currency))}</p>
          <p><CustomerText value="Refill"/> · <CustomerText value={refillTerms({refill:purchased.refill},String(purchased.service),String(purchased.description??"")).label}/></p>
        </> : <p><CustomerText value="Original service terms were not recorded for this order."/> <CustomerText value="Quantity"/> · {order.quantity} · <CustomerText value="Price"/> · {formatCurrency(order.price,order.currency)}</p>}
      </section>
      <DeliveryReceipt qty={order.quantity} remain={order.remain} status={typeof snapshot.status==="string"?snapshot.status:order.status} number={order.order_number}/>
      {order.provider_refill_id&&<p className="glass-card mt-4 p-4">Provider refill #{order.provider_refill_id} · {order.provider_refill_status||"Awaiting status"}</p>}
      {order.status==="partial"&&<p className="glass-card p-4">Ordered · {order.quantity} · Provider remaining · {order.remain??"Unreported"} · Wallet credits · {credits.error?"Unavailable":credits.data?.length?credits.data.map(r=>formatCurrency(r.amount,r.currency)).join(" + "):"No credit recorded"}</p>}
      {refundStarted && <section className="glass-card mt-4 space-y-2 p-4 text-sm"><h2 className="font-semibold"><CustomerText value="Refund tracking"/></h2>
        <ol className="space-y-2">
          <li><strong><CustomerText value="Request submitted"/></strong> · {request?dhakaTime(request.created_at):<CustomerText value={order.cancel_count?"Request recorded":"No request record"}/>}</li>
          <li><strong><CustomerText value="Provider reply"/></strong> · {finalStatus || <CustomerText value={reply?.description?.includes("acknowledged")?"Receipt acknowledged":reply?.description?.includes("declined")?"Request declined":"Awaiting confirmation"}/>}
            {finalStatus && typeof snapshot.panel_checked_at==="string" ? " · "+dhakaTime(snapshot.panel_checked_at) : reply ? " · "+dhakaTime(reply.created_at):null}</li>
          <li><strong><CustomerText value="Wallet credit"/></strong> · {credits.error?<CustomerText value="Could not load transactions."/>:credits.data?.some(r=>r.amount>0)?credits.data.filter(r=>r.amount>0).map(r=><span key={r.id} className="block">{formatCurrency(r.amount,r.currency)} · {dhakaTime(r.created_at)}</span>):<CustomerText value="No credit recorded"/>}</li>
        </ol></section>}
      {order.user_id===user.id&&<form className="glass-card mt-4 flex flex-wrap gap-3 p-4" action={saveOrderNote.bind(null,id)}><label className="grow"><CustomerText value="Private project note"/><input className="block w-full rounded border bg-background p-2" name="note" defaultValue={note.data?.note||""} maxLength={160}/></label><Button><CustomerText value="Save"/></Button></form>}
      {!!credits.data?.length&&<section className="glass-card my-4 p-4"><h2><CustomerText value="Refund breakdown"/></h2>{debits.data?.map((r,i)=><p key={i}><CustomerText value="Wallet charge"/> · {formatCurrency(Math.abs(r.amount),r.currency)}</p>)}{credits.data.map(r=><p key={r.id}><CustomerText value="Refunded"/> · {formatCurrency(r.amount,r.currency)} · {new Date(r.created_at).toLocaleString("en-GB",{timeZone:"Asia/Dhaka"})}</p>)}{order.user_id===user.id&&<Link className="underline" href={"/transactions?order="+id}><CustomerText value="Wallet activity"/></Link>}</section>}
      <section className="mt-5 space-y-3 rounded-xl border bg-card p-5">
        <h2 className="font-semibold"><CustomerText value="Order timeline" /></h2>
        {history.map(event => <div key={event.id} className="text-sm"><time className="text-muted-foreground">{new Date(event.created_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} (Dhaka)</time> · {"provider" in event && <><CustomerText value="Provider status" /> · </>}{event.href ? <Link className="text-primary underline" href={event.href}><CustomerText value={event.text} /></Link> : <CustomerText value={event.text} />}</div>)}
        {(events.error || credits.error || reports.error) ? <p>Some history could not be loaded.</p> : history.length === 0 && <p className="text-sm text-muted-foreground"><CustomerText value="No refill or refund activity recorded." /></p>}
      </section>
    </div>
  );
}
