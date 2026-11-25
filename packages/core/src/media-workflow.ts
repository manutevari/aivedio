export type MediaTaskKind = "speech.generate" | "text.translate" | "text.localize" | "text.transliterate" | "audio.denoise" | "script.critic" | "video.critic" | "quality.analyze";
export type MediaExecutionMode = "sync" | "async" | "stream";
export type MediaTaskStatus = "pending" | "queued" | "running" | "retrying" | "completed" | "failed" | "cancelled" | "awaiting_review";
export interface MediaTaskContract<TInput=Record<string,unknown>,TOutput=Record<string,unknown>> {
  id:string; projectId:string; kind:MediaTaskKind; mode:MediaExecutionMode;
  input:TInput; dependencies:string[]; timeoutMs:number; maxRetries:number;
  requiresApproval:boolean; metadata?:Record<string,unknown>;
}
export interface MediaTaskResult<T=unknown> { taskId:string; status:MediaTaskStatus; output?:T; error?:string; attempts:number; startedAt:string; completedAt?:string; }
export interface MediaTaskHandler { execute(task:MediaTaskContract, signal:AbortSignal):Promise<unknown>; }
export interface MediaWorkflowOptions { concurrency?:number; defaultTimeoutMs?:number; onStatus?:(result:MediaTaskResult)=>void|Promise<void>; }
const now=()=>new Date().toISOString();
function validateGraph(tasks:MediaTaskContract[]) {
 const ids=new Set<string>();
 for(const t of tasks){if(!t.id||ids.has(t.id))throw new Error("Media workflow task IDs must be unique and non-empty");ids.add(t.id);if(!Number.isFinite(t.timeoutMs)||t.timeoutMs<=0)throw new Error("Task timeout must be positive");if(!Number.isInteger(t.maxRetries)||t.maxRetries<0||t.maxRetries>8)throw new Error("Task maxRetries must be between 0 and 8");}
 for(const t of tasks)for(const dep of t.dependencies)if(!ids.has(dep))throw new Error("Unknown workflow dependency: "+dep);
 const visiting=new Set<string>(),visited=new Set<string>();
 const visit=(id:string)=>{if(visiting.has(id))throw new Error("Media workflow dependency cycle detected");if(visited.has(id))return;visiting.add(id);for(const d of tasks.find(t=>t.id===id)!.dependencies)visit(d);visiting.delete(id);visited.add(id)};
 for(const id of ids)visit(id);
}
async function withTimeout<T>(promise:Promise<T>,ms:number,controller:AbortController):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([promise,new Promise<T>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error("Media task timed out after "+ms+"ms"))},ms)})])}
 finally{if(timer)clearTimeout(timer)}
}
/** Deterministic DAG scheduler. Short sync tasks and queued async tasks share one contract; external queue persistence remains the worker's responsibility. */
export async function executeMediaWorkflow(tasks:MediaTaskContract[],handlers:Partial<Record<MediaTaskKind,MediaTaskHandler>>,options:MediaWorkflowOptions={}):Promise<MediaTaskResult[]>{
 validateGraph(tasks);
 const concurrency=Math.max(1,Math.min(16,Math.floor(options.concurrency??3)));
 const results=new Map<string,MediaTaskResult>();
 const pending=new Set(tasks.map(t=>t.id));
 const run=async(task:MediaTaskContract)=>{
  const startedAt=now();let attempts=0;
  const result:MediaTaskResult={taskId:task.id,status:"running",attempts,startedAt};
  results.set(task.id,result);await options.onStatus?.(result);
  const handler=handlers[task.kind];if(!handler){result.status="failed";result.error="No handler registered for "+task.kind;result.completedAt=now();await options.onStatus?.(result);return}
  while(attempts<=task.maxRetries){
   attempts++;result.attempts=attempts;const controller=new AbortController();
   try{result.output=await withTimeout(handler.execute(task,controller.signal),task.timeoutMs||options.defaultTimeoutMs||60000,controller);result.status=task.requiresApproval?"awaiting_review":"completed";result.completedAt=now();delete result.error;break}
   catch(e){result.error=e instanceof Error?e.message:String(e);result.status=attempts<=task.maxRetries?"retrying":"failed";if(attempts<=task.maxRetries)await new Promise(r=>setTimeout(r,Math.min(5000,250*2**(attempts-1))))}
  }
  await options.onStatus?.(result);
 };
 while(pending.size){
  const ready=tasks.filter(t=>pending.has(t.id)&&t.dependencies.every(d=>["completed","awaiting_review"].includes(results.get(d)?.status??"")));
  if(!ready.length){for(const id of pending){const r:MediaTaskResult={taskId:id,status:"failed",error:"Blocked by failed dependency",attempts:0,startedAt:now(),completedAt:now()};results.set(id,r);await options.onStatus?.(r)}break}
  for(let i=0;i<ready.length;i+=concurrency){const batch=ready.slice(i,i+concurrency);await Promise.all(batch.map(async t=>{await run(t);pending.delete(t.id)}))}
 }
 return tasks.map(t=>results.get(t.id)!);
}
export function chooseMediaExecutionMode(input:{durationSeconds?:number;interactive?:boolean;streaming?:boolean;batch?:boolean}):MediaExecutionMode{
 if(input.streaming||input.interactive)return "stream";
 if(input.batch||(input.durationSeconds??0)>30)return "async";
 return "sync";
}
