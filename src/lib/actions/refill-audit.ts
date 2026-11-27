"use server";
import {requireAdmin} from "@/lib/guards";
import {createAdminClient} from "@/lib/supabase/admin";
import {rateLimit} from "@/lib/rate-limit";
import {providerApi} from "@/lib/provider/smmfollow";
import {providerRefillFlag,refillTerms} from "@/lib/refill-terms";
export async function auditRefill(provider:string,id:string){
 const {user}=await requireAdmin();if(!user||!/^\d{1,20}$/.test(id))return "Select a provider and enter its numeric service ID.";
 if(!(await rateLimit("refill-audit:"+user.id,5,60)).success)return "Try again in a minute.";
 const db=createAdminClient();
 const [{data:p},{data:services}]=await Promise.all([db.from("providers").select("name,api_url,api_key").eq("id",provider).maybeSingle(),db.from("services").select("name,meta,description").eq("provider_id",provider).eq("provider_service_id",id)]);
 if(!p)return "Provider unavailable";
 try{const item=(await providerApi.getServices(p)).find(i=>i.service_id===id);
 return [p.name+" #"+id,item?"Live API · "+(providerRefillFlag(item.refill)??"unspecified")+" · "+item.name:"ID absent from live API",...(services||[]).map(s=>"Panel · "+refillTerms(s.meta,s.name,s.description||"").label)].join("\n");
 }catch{return "Provider API unavailable. Try again later.";}
}
