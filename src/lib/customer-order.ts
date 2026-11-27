export function refillDeadline(value:unknown) {
  if(!value || typeof value!=="object" || Array.isArray(value))return null;
  const r=value as Record<string,unknown>;
  const timestamp=(v:unknown)=>typeof v==="string" && /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/i.test(v)?Date.parse(v):NaN;
  const end=timestamp(r.refill_expires_at??r.refill_deadline);
  if(Number.isFinite(end))return new Date(end).toISOString();
  const start=timestamp(r.refill_starts_at),days=Number(r.refill_days);
  return Number.isFinite(start)&&Number.isInteger(days)&&days>0&&days<=3650?new Date(start+days*86400000).toISOString():null;
}
export function dhakaTime(value:string) {
  return new Date(value).toLocaleString("en-GB",{timeZone:"Asia/Dhaka",day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit",hour12:true})+" (Dhaka)";
}
