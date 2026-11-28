import {CustomerText} from "@/components/customer-language";
import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import {walletCharge} from "@/lib/pricing";
import {formatCurrency} from "@/lib/utils";
import {z} from "zod";
const batch=z.object({service:z.string().uuid(),currency:z.string(),rows:z.array(z.object({qty:z.number(),link:z.string(),usd:z.number(),id:z.string().uuid().optional(),message:z.string().optional(),uncertain:z.boolean().optional()})).max(10)});
export async function BatchHistory({user,id}:{user:string;id?:string}){
 const db=await createClient(),query=db.from("customer_settings").select("key,value").eq("user_id",user).like("key","batch:%");
 const {data,error}=await (id?query.eq("key","batch:"+id):query.order("key").limit(50));if(error)throw error;if(!data.length)return null;
 const batches=data.flatMap(record=>{const result=batch.safeParse(record.value);return result.success?[{...result.data,id:record.key.slice(6)}]:[];});
 const ids=batches.flatMap(b=>b.rows.flatMap(r=>r.id?[r.id]:[]));
 const actual=ids.length?await db.from("orders").select("id,status").eq("user_id",user).in("id",ids):{data:[]};
 const states=new Map(actual.data?.map(o=>[o.id,o.status]));
 const failed=(r:{id?:string;message?:string;uncertain?:boolean})=>r.id?["failed","rejected"].includes(states.get(r.id)||""):!!r.message&&!r.uncertain;
 return <details open={!!id} className="glass-card mb-3 p-3"><summary><CustomerText value="Order batches"/></summary>{batches.map(b=><article key={b.id} className="space-y-1 border-t py-2 text-sm"><Link className="underline" href={"/orders?batch="+b.id}>Batch {b.id.slice(0,8)}</Link> · {b.rows.filter(r=>r.id).length}/{b.rows.length} recorded · {b.rows.filter(failed).length} failed · {b.rows.filter(r=>!r.id&&(!r.message||r.uncertain)).length} pending
 <p>Reviewed total · {formatCurrency(b.rows.reduce((s,r)=>s+walletCharge(r.usd,b.currency),0),b.currency)}</p>
 {id&&b.rows.map((r,i)=><p key={i} className="break-all">{r.qty} · {r.link} · {r.id?<Link className="underline" href={"/orders/"+r.id}>{failed(r)?"Review failed order":states.get(r.id)||"View order"}</Link>:<CustomerText value={r.message||"Ready"}/>}</p>)}
 {b.rows.some(r=>!r.id)&&<Link className="underline" href={"/services/"+b.service+"?batch="+b.id}><CustomerText value="Continue batch"/></Link>}</article>)}</details>;
}
