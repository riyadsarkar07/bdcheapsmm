"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {createOrderAction} from "@/lib/actions/orders";
import {checkUrlConflictAction} from "@/lib/actions/url-check";
import {useCustomerText} from "@/components/customer-language";
import {targetLinkError} from "@/lib/order-link";
import {computeOrderCharge,walletCharge} from "@/lib/pricing";
import {formatCurrency} from "@/lib/utils";
import {Button} from "@/components/ui/button";

type Line={link:string;qty:number;usd:number;key:string;overlap:boolean;id?:string;message?:string};
export function BulkOrders({service,rate,min,max,currency,balance,user,platform,type}:{service:string;rate:number;min:number;max:number;currency:string;balance:number;user:string;platform:string;type:string|null}){
  const t=useCustomerText();
  const key="batch:"+user+":"+service;
  const [input,setInput]=useState(""),[rows,setRows]=useState<Line[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  useEffect(()=>{try{const saved=JSON.parse(sessionStorage.getItem(key)||"null");if(saved){setRows(saved.rows);setInput(saved.input);}}catch{}},[key]);
  function save(lines:Line[]){sessionStorage.setItem(key,JSON.stringify({input,rows:lines}));setRows(lines);}
  async function review(){
    setBusy(true);setError("");
    try{
      const lines=input.trim().split(/\r?\n/), next:Line[]=[];
      if(lines.length>10)throw Error(t("Maximum 10 links"));
      for(const text of lines){
        const parts=text.trim().split(/\s+/),[link,n]=parts,qty=Number(n),usd=computeOrderCharge(rate,qty);
        if(parts.length!==2||targetLinkError(link,platform,type)||!Number.isInteger(qty)||qty<min||qty>max||usd<=0||next.some(r=>r.link===link))throw Error(t("Check link and quantity on line")+" "+(next.length+1));
        const check=await checkUrlConflictAction({serviceId:service,link});
        if(!check.success)throw Error(check.error);
        next.push({link,qty,usd,key:crypto.randomUUID(),overlap:!!check.data?.conflicts.length});
      }
      save(next);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function submit(){
    setBusy(true);
    const next=rows.map(r=>({...r}));
    try{for(const row of next.filter(r=>!r.id)){
      try{const result=await createOrderAction({requestId:row.key,serviceId:service,quantity:row.qty,link:row.link,expectedUsd:row.usd});row.id=result.data?.orderId;row.message=result.data?.status||result.error;}
      catch{row.message=t("Connection interrupted. Retry to check the result.");}
      save([...next]);if(!row.id)break;
    }}finally{setBusy(false);}
  }
  const due=rows.filter(r=>!r.id).reduce((sum,r)=>sum+walletCharge(r.usd,currency),0);
  return <details className="glass-card my-4 p-4"><summary>{t("Order multiple links")}</summary>
    <label className="block py-2 text-sm">{t("One link and quantity per line")}<textarea className="block w-full rounded border bg-background p-2" rows={4} value={input} disabled={busy||!!rows.length} onChange={e=>setInput(e.target.value)}/></label>
    {error&&<p role="alert">{error}</p>}{rows.map(r=><p key={r.key} className="break-all border-b py-1 text-sm">{r.link} · {r.qty} · {formatCurrency(walletCharge(r.usd,currency),currency)} {r.overlap&&t("Active order for this link")} {r.message} {r.id&&<Link className="underline" href={"/orders/"+r.id}>{t("View order")}</Link>}</p>)}
    {rows.length?<><Button disabled={busy||!due||(due>balance&&!rows.some(r=>r.message))} onClick={submit}>{t("Confirm & Place Order")} · {formatCurrency(due,currency)}</Button>
    <Button variant="outline" disabled={busy} onClick={()=>{setRows([]);setInput("");sessionStorage.removeItem(key);}}>{t("Clear")}</Button></>:<Button disabled={busy||!input.trim()} onClick={review}>{t("Review Order")}</Button>}</details>;
}
