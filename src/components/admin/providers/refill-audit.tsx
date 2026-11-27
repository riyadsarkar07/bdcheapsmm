"use client";
import {useState} from "react";
import {auditRefill} from "@/lib/actions/refill-audit";
export function RefillAudit({providers}:{providers:{id:string;name:string}[]}){
 const [result,setResult]=useState("");
 return <details className="glass-card mb-3 p-3"><summary>Compare refill terms by provider service ID</summary><form action={async fd=>{const listed=fd.get("listed");setResult(await auditRefill(String(fd.get("provider")),String(fd.get("id")).trim())+(listed?"\nWebsite listing (entered by admin) · "+listed:""));}}><select name="provider" aria-label="Provider">{providers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><input name="id" required placeholder="Provider service ID"/><select name="listed" aria-label="Provider website listing"><option value="">Website listing unknown</option><option>Refill available</option><option>No refill</option></select><button>Check live API</button></form><p className="whitespace-pre-line">{result}</p></details>;
}
