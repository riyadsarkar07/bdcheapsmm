export function parseBatchInput(input:string){
 const lines=input.replace(/^\uFEFF/,"").trim().split(/\r?\n/);
 if(/^\s*"?(?:target[_ ]?)?(?:url|link)"?\s*,\s*"?quantity"?\s*$/i.test(lines[0]))lines.shift();
 if(lines.length>10||!lines.length)throw Error("Use 1–10 rows per batch.");
 return lines.map((line,index)=>{
  const match=line.trim().match(/^(?:"([^"]+)"|([^\s,]+))\s*(?:,\s*|\s+)"?(\d+)"?$/);
  if(!match)throw Error("Check link and quantity on line "+(index+1));return {link:(match[1]||match[2]).trim(),qty:Number(match[3])};
 });
}
