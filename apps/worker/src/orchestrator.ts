import type { WorkerJob } from "@aivedio/core";

export type AgentRole = "planner" | "improvisor" | "researcher" | "implementation" | "patcher" | "auditor" | "critic" | "safety" | "generator" | "renderer";
export type AgentStatus = "queued" | "running" | "completed" | "failed" | "blocked" | "awaiting_human";
export interface AgentTask { id:string; role:AgentRole; dependencies?:string[]; input:unknown; requiresHumanApproval?:boolean; maxRetries?:number; }
export interface AgentResult { status:AgentStatus; output?:unknown; confidence?:number; error?:string; requiresHumanApproval?:boolean; }
export interface AgentExecutor { role:AgentRole; execute(task:AgentTask, context:OrchestrationContext):Promise<AgentResult>; }
export interface OrchestrationContext { job:WorkerJob; results:Map<string,AgentResult>; route(task:AgentTask):AgentExecutor; }
export interface OrchestrationReport { status:"completed"|"failed"|"blocked"|"awaiting_human"; results:Record<string,AgentResult>; completedOrder:string[]; }
export class AgentRegistry {
 private readonly executors=new Map<AgentRole,AgentExecutor>();
 register(executor:AgentExecutor){if(this.executors.has(executor.role))throw new Error("Agent already registered: "+executor.role);this.executors.set(executor.role,executor)}
 get(role:AgentRole){return this.executors.get(role)}
 list(){return [...this.executors.keys()]}
 route(role:AgentRole){const agent=this.get(role);if(!agent)throw new Error("No agent registered for role: "+role);return agent}
}
export function validateTaskGraph(tasks:AgentTask[]):string[]{
 const errors:string[]=[];const ids=new Set<string>();
 for(const t of tasks){if(!t.id.trim())errors.push("Task id is required");if(ids.has(t.id))errors.push("Duplicate task id: "+t.id);ids.add(t.id)}
 for(const t of tasks)for(const dep of t.dependencies??[])if(!tasks.some(x=>x.id===dep))errors.push("Unknown dependency "+dep+" for "+t.id);
 const visiting=new Set<string>(),visited=new Set<string>(),byId=new Map(tasks.map(t=>[t.id,t]));
 function visit(id:string){if(visiting.has(id)){errors.push("Dependency cycle detected at "+id);return}if(visited.has(id))return;visiting.add(id);for(const dep of byId.get(id)?.dependencies??[])visit(dep);visiting.delete(id);visited.add(id)}
 for(const t of tasks)visit(t.id);return [...new Set(errors)];
}
export async function orchestrateAgents(job:WorkerJob,tasks:AgentTask[],registry:AgentRegistry):Promise<OrchestrationReport>{
 const graphErrors=validateTaskGraph(tasks);if(graphErrors.length)throw new Error("Invalid agent task graph: "+graphErrors.join("; "));
 const results=new Map<string,AgentResult>(),completedOrder:string[]=[];
 const context:OrchestrationContext={job,results,route:t=>registry.route(t.role)};
 const pending=new Map(tasks.map(t=>[t.id,t]));
 while(pending.size){
  const ready=[...pending.values()].filter(t=>(t.dependencies??[]).every(d=>results.get(d)?.status==="completed"));
  if(!ready.length){const blocked=[...pending.values()].filter(t=>(t.dependencies??[]).some(d=>["failed","blocked","awaiting_human"].includes(results.get(d)?.status??"")));for(const t of blocked)results.set(t.id,{status:"blocked",error:"Dependency did not complete"});return{status:"blocked",results:Object.fromEntries(results),completedOrder}}
  for(const task of ready){
   pending.delete(task.id);
   const agent=registry.route(task);
   let result:AgentResult={status:"failed",error:"Agent did not return a result"};
   const retries=Math.max(0,Math.min(5,task.maxRetries??0));
   for(let attempt=0;attempt<=retries;attempt++){
    try{result=await agent.execute(task,context);if(result.status!=="failed")break}catch(e){result={status:"failed",error:e instanceof Error?e.message:String(e)}}
   }
   if(task.requiresHumanApproval||result.requiresHumanApproval||result.status==="awaiting_human"){result.status="awaiting_human";results.set(task.id,result);return{status:"awaiting_human",results:Object.fromEntries(results),completedOrder}}
   results.set(task.id,result);
   if(result.status==="completed")completedOrder.push(task.id);
   if(result.status!=="completed")return{status:result.status==="blocked"?"blocked":"failed",results:Object.fromEntries(results),completedOrder};
  }
 }
 return{status:"completed",results:Object.fromEntries(results),completedOrder};
}
