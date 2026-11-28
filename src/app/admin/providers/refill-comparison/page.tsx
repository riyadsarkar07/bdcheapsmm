import Link from "next/link";
import {unstable_cache} from "next/cache";
import {requireAdmin} from "@/lib/guards";
import {createAdminClient} from "@/lib/supabase/admin";
import {dhakaTime} from "@/lib/customer-order";
import {providerRefillFlag} from "@/lib/refill-terms";
import {publicRefillButtons} from "@/lib/provider/public-refill-catalog";

const listingUrl = "https://my.smmfollowom.com/services";
const readListing = unstable_cache(async () => {
  const response = await fetch(listingUrl, {cache:"no-store",signal:AbortSignal.timeout(18000)});
  if (!response.ok || !response.body) throw Error("Catalog unavailable");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = "", bytes = 0;
  while (true) {
    const {done,value} = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 12_000_000) {await reader.cancel();throw Error("Catalog too large");}
    html += decoder.decode(value,{stream:true});
  }
  const buttons = publicRefillButtons(html + decoder.decode());
  if (!Object.keys(buttons).length) throw Error("No explicit refill labels");
  return {buttons, checkedAt:new Date().toISOString()};
},["smmfollowom-public-refill-buttons-v1"],{revalidate:3600});

export default async function RefillComparison(){
  const {user}=await requireAdmin();
  if(!user)return null;
  const db=createAdminClient();
  const {data:providers,error}=await db.from("providers").select("id,name,api_url").eq("status","active");
  if(error)throw error;
  const sources=providers.filter(p=>{try{return new URL(p.api_url).hostname==="my.smmfollowom.com";}catch{return false;}});
  if(!sources.length)return <p>No active SMMFollowOM connection.</p>;
  const listing=await readListing().catch(()=>null);
  if(!listing)return <main className="glass-card p-4"><h1>Refill comparison unavailable</h1><p>The provider website could not be read. Try the per-ID API check in Providers.</p><Link href="/admin/providers">Back to Providers</Link></main>;
  const mismatches:{id:string;name:string;provider:string;site:boolean;panel:boolean;api:boolean|null}[]=[];
  let checked=0,withoutEvidence=0;
  const timestamps:string[]=[];
  for(const provider of sources){
    const cached=await db.from("refill_catalog_evidence").select("checked_at,flags").eq("provider_id",provider.id).maybeSingle();
    if(cached.error)throw cached.error;
    const flags=cached.data?.flags;
    if(cached.data)timestamps.push(provider.name+" · "+dhakaTime(cached.data.checked_at));
    for(let offset=0;;offset+=500){
      const {data:services,error}=await db.from("services").select("id,provider_service_id,name,meta").eq("provider_id",provider.id).eq("is_active",true).order("id").range(offset,offset+499);
      if(error)throw error;
      for(const service of services){
        const id=service.provider_service_id,meta=service.meta;
        const panel=providerRefillFlag(meta&&typeof meta==="object"&&!Array.isArray(meta)?meta.refill:null);
        if(!id||!(id in listing.buttons)||panel===null){withoutEvidence++;continue;}
        checked++;
        const site=listing.buttons[id];
        const api=providerRefillFlag(flags&&typeof flags==="object"&&!Array.isArray(flags)?flags[id]:null);
        if(site!==panel || (api!==null&&api!==panel))mismatches.push({id,name:service.name,provider:provider.name,site,panel,api});
      }
      if(services.length<500)break;
    }
  }
  const label=(flag:boolean|null)=>flag===null?"Unconfirmed":flag?"Available":"Unavailable";
  return <main className="space-y-4"><Link className="underline" href="/admin/providers">Providers</Link><h1 className="text-2xl font-bold">Refill discrepancies</h1>
    <p>{mismatches.length} differences across {checked} comparable services · {withoutEvidence} with incomplete evidence</p>
    <p className="text-sm">Website checked {dhakaTime(listing.checkedAt)} · <a className="underline" href={listingUrl}>Provider listing</a></p>
    <p className="text-sm">Last API catalog · {timestamps.join(", ")||"Awaiting scheduled sync"}</p>
    <div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm"><thead><tr>{["Provider ID","Service","Website button","API flag","Panel flag"].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{mismatches.map(r=><tr className="border-t" key={r.provider+":"+r.id}><td className="p-2">{r.provider} #{r.id}</td><td className="p-2">{r.name}</td><td className="p-2">{label(r.site)}</td><td className="p-2">{label(r.api)}</td><td className="p-2">{label(r.panel)}</td></tr>)}</tbody></table></div></main>;
}
