import Fastify from "fastify";
import { classifyNode, decideNextAction } from "@aivedio/core";
const app=Fastify({logger:true});
app.get("/health",async()=>({status:"ok",service:"aivedio-api",foundation:"phase-1"}));
app.post("/v1/workflow/classify",async(request)=>{
 const body=request.body as {type:string;risk?:"low"|"medium"|"high"|"critical"};
 return classifyNode(body.type,body.risk??"low");
});
app.post("/v1/decision/evaluate",async(request)=>{
 return decideNextAction(request.body as Parameters<typeof decideNextAction>[0]);
});
const port=Number(process.env.PORT??3000);
await app.listen({port,host:"0.0.0.0"});
