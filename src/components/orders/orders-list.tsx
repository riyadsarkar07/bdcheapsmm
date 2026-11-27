"use client";

import {CopyButton} from "@/components/copy-button";
import {dhakaTime} from "@/lib/customer-order";
import {useCustomerText,CustomerText} from "@/components/customer-language";
import * as React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/empty-state";
import { OrderStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency, formatDateTime, truncate } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types/database";

type OrderRow = {
  issue?:string;ticket_id?:string|null;
  id: string;
  order_number: string;
  provider_order_id: string | null;
  provider_status: string | null;
  service_id: string | null;
  services?: { name: string } | null;
  quantity: number;
  price: number;
  status: OrderStatus;
  created_at: string;
  currency: string;
};

const PAGE_SIZE = 15;

export function OrdersList({
  initialOrders,
  initialTotal,
  userId,
  statusFilter,
}: {
  initialOrders: OrderRow[];
  initialTotal: number;
  userId: string;
  statusFilter?: string;
}) {
  const t=useCustomerText();
  const supabase = createClient();
  const [visible, setOrders] = React.useState(initialOrders);
  const [total, setTotal] = React.useState(initialTotal);
  const [error, setError] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState(statusFilter ?? "all");
  const [from,setFrom]=React.useState(""),[to,setTo]=React.useState(""),[platform,setPlatform]=React.useState(""),[exporting,setExporting]=React.useState(false);
  const [attention,setAttention]=React.useState(false);
  const [page, setPage] = React.useState(0);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);

  const load=React.useCallback(async(offset:number,size:number)=>{
    let q=supabase.from(attention?"customer_action_orders":"customer_order_index").select("*",{count:"exact"});
    if(status!=="all")q=q.eq("status",status as OrderStatus);
    if(from)q=q.gte("created_at",from+"T00:00:00+06:00");
    if(to)q=q.lte("created_at",to+"T23:59:59.999999+06:00");
    if(platform)q=q.ilike("category_name","%"+platform+"%");
    const term=search.trim().replace(/^#/,"");
    if(term){const pattern=JSON.stringify("%"+term.replace(/[\\%_]/g,"\\$&")+"%");
      q=q.or(["order_number","provider_order_id","link","service_name","note"].map(f=>f+".ilike."+pattern).join(","));}
    return await q.order("created_at",{ascending:false}).order("id").range(offset,offset+size-1);
  },[supabase,status,search,from,to,platform,attention]);
  async function exportCsv(){
    setExporting(true);
    try{
      const lines=[["Order","Provider ID","Service","Link","Quantity","Price","Currency","Status","Date","Project"]];
      for(let offset=0;;offset+=500){const result=await load(offset,500);if(result.error)throw result.error;
        for(const r of result.data)lines.push([r.order_number,r.provider_order_id||"",r.service_name||"",r.link,String(r.quantity),String(r.price),r.currency,r.provider_status||r.status,r.created_at,r.note||""]);
        if(result.data.length<500)break;}
      const content=lines.map(row=>row.map(v=>'"'+(/^[=+@\-\t\r]/.test(v)?"'":"")+v.replaceAll('"','""')+'"').join(",")).join("\r\n");
      const url=URL.createObjectURL(new Blob(["\uFEFF",content],{type:"text/csv;charset=utf-8"}));
      const a=document.createElement("a");a.href=url;a.download="orders.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch{setError(t("Could not export orders"));}finally{setExporting(false);}
  }
  React.useEffect(() => {
    let active = true;
    let revision = 0;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      const version = ++revision;
      const result=await load(page*PAGE_SIZE,PAGE_SIZE);
      if (!active || revision !== version) return;
      if (result.error?.code === "PGRST103" && page > 0) { setPage(0); return; }
      if (result.error) { setError("Could not load orders. Please try again."); return; }
      setError("");
      setOrders((result.data||[]).map(r=>({...r,service_id:null,services:{name:r.service_name||"Service"}})));
      setTotal(result.count ?? 0);
      setPage(p => Math.min(p, Math.max(0, Math.ceil((result.count ?? 0) / PAGE_SIZE) - 1)));
    }
    function schedule() { clearTimeout(timer); timer = setTimeout(refresh, 300); }
    schedule();
    const channel = supabase.channel("orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${userId}` }, schedule)
      .subscribe();
    const poll = setInterval(schedule, 30_000);
    return () => { active = false; clearTimeout(timer); clearInterval(poll); void supabase.removeChannel(channel); };
  }, [supabase,userId,load,page]);

  function followup(row:OrderRow){
    if(!attention || !row.issue)return null;
    const href=row.ticket_id?"/support/"+row.ticket_id:row.issue==="Refill declined"?"/support/new?order="+row.id+"&drop=1":"/orders/"+row.id+"#order-actions";
    return <div className="my-2 text-sm"><p>{t(row.issue)}</p><Link className="text-primary underline" href={href}>{t(row.ticket_id?"View reply":row.issue==="Refill declined"?"Review drop report":"Review order")}</Link></div>;
  }
  return (
    <div className="space-y-4">
      <Button aria-pressed={attention} variant={attention?"gradient":"outline"} onClick={()=>{setAttention(v=>!v);setPage(0);}}>{t("Needs your attention")}</Button>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("Search ID, link, service or project")}
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            aria-label="Search orders"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending"><CustomerText value="Pending" /></SelectItem>
            <SelectItem value="processing"><CustomerText value="Processing" /></SelectItem>
            <SelectItem value="in_progress"><CustomerText value="In Progress" /></SelectItem>
            <SelectItem value="completed"><CustomerText value="Completed" /></SelectItem>
            <SelectItem value="partial"><CustomerText value="Partial" /></SelectItem>
            <SelectItem value="cancelled"><CustomerText value="Cancelled" /></SelectItem>
            <SelectItem value="refunded"><CustomerText value="Refunded" /></SelectItem>
            <SelectItem value="rejected"><CustomerText value="Rejected" /></SelectItem>
            <SelectItem value="failed"><CustomerText value="Failed" /></SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-end gap-3 text-sm"><label>{t("From")}<Input type="date" value={from} onChange={e=>{setFrom(e.target.value);setPage(0);}}/></label>
        <label>{t("To")}<Input type="date" min={from} value={to} onChange={e=>{setTo(e.target.value);setPage(0);}}/></label>
        <label>{t("Platform")}<Input value={platform} placeholder="Facebook" onChange={e=>{setPlatform(e.target.value);setPage(0);}}/></label>
        <Button variant="outline" disabled={exporting} onClick={exportCsv}>CSV ↓</Button><Link className="p-2 text-primary underline" href="/orders/refills">{t("My refill requests")}</Link></div>
      {error ? <p role="alert">{error}</p> : visible.length === 0 ? (
        <EmptyState
          title="No matching orders"
          description="Try a different search term or status filter."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Order #</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground"><CustomerText value="Service" /></th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground"><CustomerText value="Price" /></th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground"><CustomerText value="Date" /></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((order) => (
                    <tr key={order.id} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link href={`/orders/${order.id}`} className="font-semibold text-primary hover:underline">
                          #{order.order_number}
                        </Link>
                        {followup(order)}
                        {order.provider_order_id && (
                          <p className="break-all text-xs text-muted-foreground">Provider Order ID: {order.provider_order_id}</p>
                        )}
                      </td>
                      <td className="max-w-[280px] px-4 py-3">
                        <span className="line-clamp-1">{truncate(order.services?.name ?? "Service", 50)}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{order.quantity.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{formatCurrency(order.price, order.currency)}</td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge providerStatus={order.provider_status || (order.provider_order_id ? "Awaiting provider status" : null)} status={order.status} />
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {dhakaTime(order.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y md:hidden">
              {visible.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/orders/${order.id}`}
                    className="block px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2"><p className="min-w-0 flex-1 break-words font-semibold">{order.services?.name ?? t("Service")}</p>
                      <OrderStatusBadge providerStatus={order.provider_status} status={order.status}/></div>
                    <p className="mt-2">{t("Quantity")} {order.quantity.toLocaleString()} · {formatCurrency(order.price,order.currency)}</p><small>{dhakaTime(order.created_at)}</small></Link>
                    <div className="space-y-1 px-4 pb-3 text-xs">{followup(order)}<div className="break-all">#{order.order_number} <CopyButton value={order.order_number}/></div>
                    {order.provider_order_id&&<div className="break-all">{t("Provider Order ID")} · {order.provider_order_id} <CopyButton value={order.provider_order_id}/></div>}
                    <Link href={"/support/new?order="+order.id} className="text-primary underline">{t("Get order support")}</Link></div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {total > PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Page {safePage + 1} of {pageCount} · {total} orders
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
            >
              <ChevronLeft /> <CustomerText value="Prev" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
            >
              <CustomerText value="Next" /> <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
