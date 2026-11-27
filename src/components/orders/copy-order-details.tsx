"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCustomerText } from "@/components/customer-language";

export function CopyOrderDetails({number,provider,service,quantity,status}:{
  number:string;provider:string|null;service:string;quantity:number;status:string;
}) {
  const t=useCustomerText();
  const [result,setResult]=useState<"copied"|"manual"|null>(null);
  const text=[
    [t("Order Number"),"#"+number],[t("Provider Order ID"),provider||t("Not reported yet")],
    [t("Service"),service],[t("Quantity"),quantity],[t("Order status"),status],
  ].map(([label,value])=>label+" · "+value).join("\n");
  return <div>
    <Button className="w-full" variant="outline" onClick={async()=>{
      try {await navigator.clipboard.writeText(text);setResult("copied");}
      catch {setResult("manual");}
    }}><Copy/>{t("Copy order details")}</Button>
    {result==="copied" && <p role="status" className="text-xs">{t("Copied")}</p>}
    {result==="manual" && <textarea aria-label={t("Copy order details")} className="mt-2 w-full rounded border bg-background p-2 text-sm" rows={6} readOnly value={text} autoFocus onFocus={e=>e.target.select()}/>}
  </div>;
}
