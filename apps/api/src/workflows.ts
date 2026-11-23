import {requireDb} from "./db.js";
export type RunStatus="pending"|"running"|"paused"|"awaiting_approval"|"completed"|"failed"|"cancelled";
const allowed:Record<RunStatus,RunStatus[]>={pending:["running","cancelled"],running:["paused","awaiting_approval","completed","failed","cancelled"],paused:["running","cancelled"],awaiting_approval:["running","cancelled"],completed:[],failed:["running","cancelled"],cancelled:[]};
export function canTransition(from:RunStatus,to:RunStatus){return allowed[from]?.includes(to)??false;}
export async function createRun(projectId:string|null,name:string,graph:unknown){
 const db=requireDb(); const result=await db.query("INSERT INTO workflow_runs(project_id,name,graph) VALUES($1,$2,$3) RETURNING *",[projectId,name,graph]);
 const run=result.rows[0]; await db.query("INSERT INTO workflow_events(run_id,event_type,payload) VALUES($1,'created',$2)",[run.id,{name}]); return run;
}
export async function transitionRun(id:string,to:RunStatus){
 const db=requireDb(); const c=await db.query("SELECT status FROM workflow_runs WHERE id=$1",[id]); if(!c.rowCount)throw new Error("Run not found");
 const from=c.rows[0].status as RunStatus;if(!canTransition(from,to))throw new Error(`Invalid workflow transition: ${from} -> ${to}`);
 const r=await db.query("UPDATE workflow_runs SET status=$2,updated_at=now() WHERE id=$1 RETURNING *",[id,to]);
 await db.query("INSERT INTO workflow_events(run_id,event_type,payload) VALUES($1,'status_changed',$2)",[id,{from,to}]);return r.rows[0];
}
export async function saveCheckpoint(runId:string,nodeId:string,payload:unknown){
 const db=requireDb();const r=await db.query("INSERT INTO checkpoints(run_id,node_id,payload) VALUES($1,$2,$3) RETURNING *",[runId,nodeId,payload]);
 await db.query("INSERT INTO workflow_events(run_id,event_type,payload) VALUES($1,'checkpoint_saved',$2)",[runId,{checkpointId:r.rows[0].id,nodeId}]);return r.rows[0];
}
