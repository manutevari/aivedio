import test from "node:test";
import assert from "node:assert/strict";
import {AgentRegistry,validateTaskGraph,orchestrateAgents} from "./orchestrator.js";
import {routeGenerationJob} from "./router.js";
const job:any={id:"j1",projectId:"p1",task:"video",providerId:"missing",prompt:"",inputAssets:[],parameters:{},status:"queued",attempt:0,maxAttempts:2,workerId:"test"};
test("task graph rejects duplicate ids, unknown dependencies and cycles",()=>{
 assert.ok(validateTaskGraph([{id:"a",role:"planner",input:{}},{id:"a",role:"auditor",input:{}}]).some(x=>x.includes("Duplicate")));
 assert.ok(validateTaskGraph([{id:"a",role:"planner",dependencies:["z"],input:{}}]).some(x=>x.includes("Unknown dependency")));
 assert.ok(validateTaskGraph([{id:"a",role:"planner",dependencies:["b"],input:{}},{id:"b",role:"auditor",dependencies:["a"],input:{}}]).some(x=>x.includes("cycle")));
});
test("router does not silently substitute a provider",()=>{const route=routeGenerationJob(job);assert.equal(route.selected,"");assert.equal(route.confidence,0)});
test("orchestrator routes role, honors dependency order and human gate",async()=>{
 const registry=new AgentRegistry(),order:string[]=[];
 for(const role of ["planner","auditor"] as const)registry.register({role,execute:async task=>{order.push(task.id);return{status:"completed",output:task.id,confidence:.95}}});
 const report=await orchestrateAgents(job,[{id:"plan",role:"planner",input:{}},{id:"audit",role:"auditor",dependencies:["plan"],input:{}}],registry);
 assert.equal(report.status,"completed");assert.deepEqual(order,["plan","audit"]);
 const gated=await orchestrateAgents(job,[{id:"review",role:"auditor",input:{},requiresHumanApproval:true}],registry);
 assert.equal(gated.status,"awaiting_human");
});
