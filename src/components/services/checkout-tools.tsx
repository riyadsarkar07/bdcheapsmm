"use client";
import {CustomerText} from "@/components/customer-language";
import {useState} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {createClient} from "@/lib/supabase/client";
import {persist,preference} from "@/lib/customer-workspace";
import {quantityForBdtBudget} from "@/lib/pricing";
import {targetLinkError} from "@/lib/order-link";
import {toast} from "sonner";

export function SpendingLimits({user,currency,total,largest=total}:{user:string;currency:string;total:number;largest?:number}){
 const key="limits:"+currency,query=useQueryClient();
 const {data}=useQuery({queryKey:[key,user],queryFn:async()=>{
  const prefs=await preference(user,key),obj=prefs&&typeof prefs==="object"&&!Array.isArray(prefs)?prefs:{};
  const {data:spent,error}=await createClient().rpc("today_wallet_spend",{p_currency:currency});if(error)throw error;
  return {single:Number(obj.single)||0,daily:Number(obj.daily)||0,spent:Number(spent)};
 },staleTime:15000});
 return <div className="space-y-2 text-sm">{data&&((data.single>0&&largest>data.single)||(data.daily>0&&total+data.spent>data.daily))&&<p role="alert" className="rounded border border-amber-500 p-2">Spending limit exceeded · spent today {data.spent} {currency} · pending {total} {currency}</p>}
 <details><summary><CustomerText value="Spending preferences"/> · {currency}</summary>{data&&<div className="space-y-1"><label>Per order <input className="w-20 border" type="number" min="0" defaultValue={data.single}/></label><label>Daily <input className="w-20 border" type="number" min="0" defaultValue={data.daily}/></label> <button type="button" onClick={async e=>{
 const inputs=e.currentTarget.parentElement?.querySelectorAll("input");if(!inputs)return;const [single,daily]=Array.from(inputs).map(i=>Number(i.value));
 if(![single,daily].every(v=>Number.isFinite(v)&&v>=0))return;
 try{await persist(user,key,{single,daily});await query.invalidateQueries({queryKey:[key,user]});toast.success("Saved");}catch{toast.error("Could not save limits");}
 }}>Save</button></div>}</details></div>;
}

export function CheckoutTools({user,service,platform,type,link,rate,min,max,onLink,onQuantity}:{user:string;service:string;platform:string;type:string|null;link:string;rate:number;min:number;max:number;onLink:(v:string)=>void;onQuantity:(v:number)=>void}){
 const [budget,setBudget]=useState(""),[name,setName]=useState("");
 const links=useQuery({queryKey:["saved-targets",user],queryFn:async()=>{
 const {data,error}=await createClient().from("customer_settings").select("key,value").eq("user_id",user).like("key","target:%").order("key");if(error)throw error;return data;
 }});
 const sample=useQuery({queryKey:["recent-delivery",service],staleTime:600000,queryFn:async()=>(await createClient().rpc("delivery_sample",{p_service:service})).data?.[0]??null});
 const fixed=link.trim().replace(/^(https?:\/\/)(?:https?:\/\/)+/i,"$1").replace(/\s+/g,"");
 const quantity=quantityForBdtBudget(Number(budget),rate,min,max);
 return <div className="space-y-2 text-sm">{sample.data&&<p>{sample.data.minutes!=null?"Median delivery · "+sample.data.minutes+" min":"Measuring delivery time"} · {sample.data.samples} completed in 30 days</p>}
 {fixed!==link&&!targetLinkError(fixed,platform,type)&&<button type="button" className="break-all underline" onClick={()=>onLink(fixed)}><CustomerText value="Use corrected link"/> · {fixed}</button>}
 <details className="rounded border p-2"><summary><CustomerText value="Budget calculator · ৳"/></summary><input aria-label="Budget before coupons in BDT" placeholder="Budget in BDT" type="number" value={budget} onChange={e=>setBudget(e.target.value)}/><button type="button" disabled={!quantity} onClick={()=>onQuantity(quantity)}>{quantity?"Use quantity "+quantity:"Below minimum charge"}</button></details>
 <details className="rounded border p-2"><summary><CustomerText value="Saved target links"/></summary>{links.data?.map(r=><button className="block underline" key={r.key} type="button" onClick={()=>onLink(String(r.value))}>{r.key.slice(7)}</button>)}
 <input placeholder="Link name" maxLength={60} value={name} onChange={e=>setName(e.target.value)}/><button type="button" disabled={!name.trim()||!!targetLinkError(link,platform,type)} onClick={async()=>{try{await persist(user,"target:"+name.trim(),link);setName("");await links.refetch();}catch{toast.error("Could not save link");}}}><CustomerText value="Save current link"/></button></details></div>;
}
