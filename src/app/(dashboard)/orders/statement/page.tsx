import {CustomerText} from "@/components/customer-language";
import Link from "next/link";
import {requireUser} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {formatCurrency} from "@/lib/utils";
export default async function Statement({searchParams}:{searchParams:Promise<{month?:string}>}){
 const {user}=await requireUser();if(!user)return null;
 const month=(await searchParams).month||new Date(Date.now()+21600000).toISOString().slice(0,7);
 if(!/^\d{4}-(0[1-9]|1[012])$/.test(month))return <p>Invalid month</p>;
 const db=await createClient();
 const rows:{project:string;order_number:string;posted:string;entry:string;amount:number;currency:string}[]=[];
 for(let offset=0;;offset+=500){
   const {data,error}=await db.rpc("monthly_order_statement",{p_month:month+"-01"}).range(offset,offset+499);
   if(error)throw error;rows.push(...data);if(data.length<500)break;
 }
 const csv=(v:string)=>'"'+(/^[=+\-@\t\r]/.test(v)?"'":"")+v.replace(/"/g,'""')+'"';
 const lines=rows.map(r=>[r.project,r.order_number,r.posted,r.entry,String(r.amount),r.currency].map(csv).join(","));
 const totals=new Map<string,number>();for(const r of rows){const k=JSON.stringify([r.project,r.currency]);totals.set(k,(totals.get(k)||0)+(r.entry==="refund"?-1:1)*Math.abs(r.amount));}
 return <main className="glass-card space-y-4 p-4"><Link href="/orders">My Orders</Link><h1><CustomerText value="Monthly client statement"/></h1><form><input type="month" aria-label="Statement month" name="month" defaultValue={month}/><button>View</button></form>
 <a className="underline" download={"statement-"+month+".csv"} href={"data:text/csv;charset=utf-8,"+encodeURIComponent("\uFEFFProject,Order,Posted (UTC),Entry,Amount,Currency\r\n"+lines.join("\r\n"))}><CustomerText value="Download CSV"/></a>
 <p>Net wallet spend by private project note · Dhaka calendar month</p>{!rows.length&&<p><CustomerText value="No order transactions this month."/></p>}
 {Array.from(totals).map(([key,v])=>{const [name,currency]=JSON.parse(key);return <p key={key}>{name} · {formatCurrency(v,currency)}</p>;})}</main>;
}
