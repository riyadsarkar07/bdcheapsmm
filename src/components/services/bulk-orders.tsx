"use client";
import {CustomerText} from "@/components/customer-language";
import {parseBatchInput} from "@/lib/batch-input";
import {createClient} from "@/lib/supabase/client";
import {preference} from "@/lib/customer-workspace";
import {SpendingLimits} from "./checkout-tools";
import {useEffect,useState,useRef} from "react";
import Link from "next/link";
import {createOrderAction} from "@/lib/actions/orders";
import {checkUrlConflictAction} from "@/lib/actions/url-check";
import {useCustomerText} from "@/components/customer-language";
import {targetLinkError} from "@/lib/order-link";
import {computeOrderCharge,walletCharge} from "@/lib/pricing";
import {formatCurrency} from "@/lib/utils";
import {Button} from "@/components/ui/button";

type Line={link:string;qty:number;usd:number;key:string;overlap:boolean;id?:string;message?:string;uncertain?:boolean;editable?:boolean;revised?:number};
export function BulkOrders({service,rate,min,max,currency,balance,user,platform,type}:{service:string;rate:number;min:number;max:number;currency:string;balance:number;user:string;platform:string;type:string|null}){
  const t=useCustomerText();
  const key="batch:"+user+":"+service;
  const [input,setInput]=useState(""),[rows,setRows]=useState<Line[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const version=useRef(0);
  const [group,setGroup]=useState(""),[editing,setEditing]=useState<string|null>(null),[lineText,setLineText]=useState("");
  useEffect(()=>{
    const id=new URLSearchParams(location.search).get("batch");
    if(id&&/^[a-f0-9-]{36}$/i.test(id)){
      void preference(user,"batch:"+id).then(v=>{
        if(v&&typeof v==="object"&&!Array.isArray(v)&&v.service===service&&Array.isArray(v.rows)){version.current=Number(v.version)||0;setRows(v.rows as Line[]);setGroup(id);}
      }).catch(()=>setError("Could not restore batch"));return;
    }
    try{const saved=JSON.parse(sessionStorage.getItem(key)||"null");if(saved){version.current=Number(saved.version)||0;setRows(saved.rows);setInput(saved.input);setGroup(saved.group||crypto.randomUUID());}}catch{}},[key,user,service]);
  async function save(lines:Line[],id=group){
    const {data,error}=await createClient().rpc("save_order_batch",{p_id:id,p_version:version.current,p_batch:JSON.parse(JSON.stringify({service,currency,rows:lines}))});
    if(error||!data)throw Error("Could not save batch. Reopen its summary before retrying.");
    version.current=data;sessionStorage.setItem(key,JSON.stringify({input,rows:lines,group:id,version:data}));setRows([...lines]);
  }
  async function review(){
    setBusy(true);setError("");
    try{
      const lines=parseBatchInput(input), next:Line[]=[];
      if(lines.length>10)throw Error(t("Maximum 10 links"));
      for(const {link,qty} of lines){
        const usd=computeOrderCharge(rate,qty);
        if(targetLinkError(link,platform,type)||!Number.isInteger(qty)||qty<min||qty>max||usd<=0||next.some(r=>r.link===link))throw Error(t("Check link and quantity on line")+" "+(next.length+1));
        const check=await checkUrlConflictAction({serviceId:service,link});
        if(!check.success)throw Error(check.error);
        next.push({link,qty,usd,key:crypto.randomUUID(),overlap:!!check.data?.conflicts.length});
      }
      const id=crypto.randomUUID();version.current=0;setGroup(id);await save(next,id);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function submit(){
    setBusy(true);
    const next=rows.map(r=>({...r}));
    try{await save(next);for(const row of next.filter(r=>!r.id)){
      try{const result=await createOrderAction({requestId:row.key,serviceId:service,quantity:row.qty,link:row.link,expectedUsd:row.usd});row.uncertain=false;row.id=result.data?.orderId;row.message=result.data?.status||result.error;row.revised=result.revisedUsd;
        row.editable=!row.id&&!!result.error&&/link|quantity|price changed|balance/i.test(result.error);}
      catch{row.uncertain=true;row.editable=false;row.message="Connection interrupted. Retry to check the result."; }
      await save([...next]);
      if(row.uncertain)break;
    }}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const due=rows.filter(r=>!r.id).reduce((sum,r)=>sum+walletCharge(r.usd,currency),0);
  return <details className="glass-card my-4 p-4"><summary>{t("Order multiple links")}</summary>
    {group&&<Link className="underline" href={"/orders?batch="+group}><CustomerText value="View batch summary"/></Link>}
    <label className="block min-w-0 text-sm"><CustomerText value="Import CSV (link, quantity)"/><input className="block max-w-full" type="file" accept=".csv,text/csv" disabled={busy||!!rows.length} onChange={async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>32000){setError("CSV is too large");return;}setInput(await f.text());setError("");}}/></label>
    <label className="block py-2 text-sm">{t("One link and quantity per line")}<textarea className="block w-full rounded border bg-background p-2" rows={4} value={input} disabled={busy||!!rows.length} onChange={e=>setInput(e.target.value)}/></label>
    {error&&<p role="alert">{error}</p>}{rows.slice().sort((a,b)=>Number(!!b.message&&!b.id)-Number(!!a.message&&!a.id)).map(r=><div key={r.key} className="break-all border-b py-1 text-sm">{((r.message&&!r.id&&!r.uncertain)||r.message==="failed"||r.message==="rejected")&&<strong>{t("Failed")} · </strong>}{r.link} · {r.qty} · {formatCurrency(walletCharge(r.usd,currency),currency)} {r.overlap&&t("Active order for this link")} {r.message&&t(r.message)} {r.revised!=null&&<strong>New charge · {formatCurrency(walletCharge(r.revised,currency),currency)}</strong>} {r.id&&<Link className="underline" href={"/orders/"+r.id}>{t("View order")}</Link>}
    {r.editable&&<button className="ml-2 underline" disabled={busy} onClick={()=>{setEditing(r.key);setLineText(r.link+" "+r.qty);}}><CustomerText value="Edit failed row"/></button>}
    {editing===r.key&&<div><input aria-label="Correct link and quantity" value={lineText} onChange={e=>setLineText(e.target.value)}/><button disabled={busy} onClick={async()=>{
       try{const parsed=parseBatchInput(lineText);if(parsed.length!==1)throw Error("Enter one row");const {link,qty}=parsed[0];
       if(targetLinkError(link,platform,type)||qty<min||qty>max||computeOrderCharge(rate,qty)<=0||rows.some(o=>o.key!==r.key&&o.link===link))throw Error("Check the link and quantity");
       const check=await checkUrlConflictAction({link,serviceId:service});if(!check.success)throw Error("Could not validate link");
       const usd=r.revised!=null&&qty===r.qty?r.revised:computeOrderCharge(rate,qty);
       await save(rows.map(o=>o.key===r.key?{key:crypto.randomUUID(),link,qty,usd,overlap:!!check.data?.conflicts.length}:o));setEditing(null);
       }catch(e){setError((e as Error).message);}
    }}><CustomerText value="Review correction"/></button></div>}</div>)}
    {rows.length?<><SpendingLimits user={user} currency={currency} total={due} largest={Math.max(0,...rows.filter(r=>!r.id).map(r=>walletCharge(r.usd,currency)))}/><Button disabled={busy||!!editing||!due||(due>balance&&!rows.some(r=>r.message))} onClick={submit}>{t("Confirm & Place Order")} · {formatCurrency(due,currency)}</Button>
    <Button variant="outline" disabled={busy} onClick={()=>{setRows([]);setInput("");setGroup("");sessionStorage.removeItem(key);}}>{t("Clear")}</Button></>:<Button disabled={busy||!input.trim()} onClick={review}>{t("Review Order")}</Button>}</details>;
}
