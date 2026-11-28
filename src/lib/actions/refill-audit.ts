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
 const [{data:p},{data:services},{data:cache}]=await Promise.all([db.from("providers").select("name,api_url,api_key").eq("id",provider).maybeSingle(),db.from("services").select("name,meta,description").eq("provider_id",provider).eq("provider_service_id",id),db.from("refill_catalog_evidence").select("flags,checked_at").eq("provider_id",provider).maybeSingle()]);
 if(!p)return "Provider unavailable";
 const flag=cache?.flags&&typeof cache.flags==="object"&&!Array.isArray(cache.flags)?cache.flags[id]:null;
 const cached=cache?"Last catalog sync · "+cache.checked_at+" · "+(typeof flag==="boolean"?String(flag):"not supplied"):"No saved API observation";
 const panel=(services||[]).map(s=>"Panel · "+refillTerms(s.meta,s.name,s.description||"").label);
 try{const item=(await providerApi.getServices(p)).find(i=>i.service_id===id);
 return [p.name+" #"+id,item?"Live API · "+(providerRefillFlag(item.refill)??"unspecified")+" · "+item.name:"ID absent from live API",cached,...panel].join("\n");
 }catch{return ["Live API unavailable",cached,...panel].join("\n");}
}
