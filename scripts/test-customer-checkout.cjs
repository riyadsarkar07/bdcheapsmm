const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),Module=require("node:module"),ts=require("typescript");
const resolve=Module._resolveFilename;
Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith("@/")?path.join(__dirname,"../src",name.slice(2)):name,...args);};
require.extensions[".ts"]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {parseBatchInput}=require("../src/lib/batch-input.ts");
const {quantityForBdtBudget,computeOrderCharge,walletCharge}=require("../src/lib/pricing.ts");
const {providerApi}=require("../src/lib/provider/smmfollow.ts");
const {refillBlock}=require("../src/lib/refill-eligibility.ts");
async function run(){
 assert.deepEqual(parseBatchInput('link,quantity\n"https://example.invalid/x",20'),[{link:"https://example.invalid/x",qty:20}]);assert.throws(()=>parseBatchInput("x,2.5"));
 for(const budget of [.01,1,1.26,6,126,252]){
  const q=quantityForBdtBudget(budget,.15,10,50000),cost=n=>walletCharge(computeOrderCharge(.15,n),"BDT");
  if(q)assert.ok(cost(q)>0&&cost(q)<=budget);if(q&&q<50000)assert.ok(cost(q+1)>budget);
 }
 const provider={name:"Fixture",api_url:"https://fixture.invalid",api_key:"fixture"},calls=[];
 global.fetch=async(url,options)=>{
  assert.equal(url,provider.api_url);const query=new URLSearchParams(options.body),action=query.get("action");calls.push(action);
  const outputs={add:{order:71},status:{status:"Partial",remains:"2"},refill:{refill:99},refill_status:{status:"In progress"}};
  if(action==="refill")assert.equal(query.get("order"),"71");if(action==="refill_status")assert.equal(query.get("refill"),"99");assert.ok(outputs[action]);return Response.json(outputs[action]);
 };
 const order=await providerApi.createOrder(provider,{service:100,link:"https://example.invalid",quantity:20});
 const snapshot=await providerApi.getStatus(provider,order.order);assert.equal(snapshot.status,"Partial");
 const candidate={status:"partial",refill_count:0,provider_order_id:String(order.order),provider_id:"fixture",provider_response:snapshot,services:{meta:{refill:true},name:"Fixture",description:null}};
 assert.equal(refillBlock(candidate),null);
 const receipt=await providerApi.refill(provider,order.order),status=await providerApi.refillStatus(provider,receipt.reference);
 assert.equal(status,"In progress");assert.ok(refillBlock({...candidate,provider_refill_status:status}));
 assert.deepEqual(calls,["add","status","refill","refill_status"]);console.log("Customer checkout and provider tests passed");
}
run().catch(e=>{console.error(e);process.exitCode=1;});
