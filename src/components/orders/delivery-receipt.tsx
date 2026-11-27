"use client";
import {CustomerText} from "@/components/customer-language";
import {useState} from "react";
export function DeliveryReceipt({qty,remain,status,number}:{qty:number;remain:number|null;status:string;number:string}){
 const [message,setMessage]=useState("");const count=remain!=null&&remain>=0&&remain<=qty?qty-remain:null;
 const content=["Delivery receipt","#"+number,"Status · "+status,"Ordered · "+qty,"Delivered · "+(count??"Unreported"),"Remaining · "+(remain??"Unreported")].join("\n");
 return <details className="glass-card mt-4 p-4"><summary><CustomerText value="Delivery receipt"/></summary><pre className="whitespace-pre-wrap py-2">{content}</pre><button className="underline" onClick={async()=>{try{if(navigator.share)await navigator.share({text:content});else{await navigator.clipboard.writeText(content);setMessage("Copied");}}catch{setMessage("Select and copy the receipt above.");}}}><CustomerText value="Share delivery receipt"/></button> <span role="status">{message}</span></details>;
}
