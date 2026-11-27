import {refillDeadline} from "./customer-order";
import {refillTerms} from "./refill-terms";
type Candidate={status:string;provider_id:string|null;provider_order_id:string|null;refill_count:number|null;provider_response:unknown;provider_refill_status?:string|null;refill_claimed_at?:string|null;services:{meta:unknown;name:string;description:string|null}|null};
export function refillBlock(o:Candidate,override=false){
 if(!o.provider_order_id||!o.provider_id)return "No provider order reference.";
 if(!["completed","partial"].includes(o.status))return "Refill requires a completed or partial order.";
 const end=refillDeadline(o.provider_response);
 if(end&&Date.parse(end)<=Date.now())return "Refill window ended";
 const raw=o.provider_response as {refill_status?:unknown}|null,state=String(o.provider_refill_status||raw?.refill_status||"").trim().toLowerCase();
 if(o.refill_claimed_at||["pending","processing","in progress","in_progress","submitted"].includes(state))return "A refill is under review";
 if(!override&&refillTerms(o.services?.meta,o.services?.name,o.services?.description??"").disabled)return "Refill is not available for this service.";
 if((o.refill_count??0)>=2)return "Refill limit reached for this order.";
 return null;
}
