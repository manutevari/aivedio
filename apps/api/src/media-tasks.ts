import {requireDb} from "./db.js";
import {chooseMediaExecutionMode,type MediaTaskContract, type MediaTaskKind} from "@aivedio/core";
export async function enqueueMediaTask(projectId:string,userId:string,input:{kind:MediaTaskKind;input:Record<string,unknown>;mode?:"sync"|"async"|"stream";dependencies?:string[];requiresApproval?:boolean}){
 const supportedKinds:MediaTaskKind[]=["speech.generate","text.translate","text.localize","text.transliterate","audio.denoise"];
 if(!supportedKinds.includes(input.kind))throw new Error("Task kind is not implemented by the media worker: "+input.kind);
 if(input.mode==="stream")throw new Error("Streaming media tasks are not enabled yet; use async mode");
 const dependencies=input.dependencies??[];
 if(dependencies.length){const found=await requireDb().query("SELECT id FROM media_task_jobs WHERE project_id=$1 AND id=ANY($2::uuid[])",[projectId,dependencies]);if(found.rowCount!==dependencies.length)throw new Error("Every dependency must exist in the same project");}
 const mode=input.mode??chooseMediaExecutionMode({durationSeconds:Number(input.input.durationSeconds??0),interactive:input.kind==="speech.generate"&&input.input.streaming===true,batch:input.input.batch===true});
 const r=await requireDb().query("INSERT INTO media_task_jobs(project_id,kind,execution_mode,input,dependencies,requires_approval,created_by,status) VALUES($1,$2,$3,$4,$5::uuid[],$6,$7,'queued') RETURNING id,project_id,kind,execution_mode,input,dependencies,requires_approval,status,attempt,created_at",[projectId,input.kind,mode,input.input,dependencies,input.requiresApproval??(input.kind==="speech.generate"||input.kind==="audio.denoise"),userId]);
 return r.rows[0];
}
export async function getMediaTask(projectId:string,id:string){return (await requireDb().query("SELECT * FROM media_task_jobs WHERE project_id=$1 AND id=$2",[projectId,id])).rows[0]??null}
export async function listMediaTasks(projectId:string){return (await requireDb().query("SELECT id,kind,execution_mode,status,attempt,error,created_at,updated_at,completed_at FROM media_task_jobs WHERE project_id=$1 ORDER BY created_at DESC LIMIT 100",[projectId])).rows}

export async function reviewMediaTask(projectId:string,id:string,userId:string,decision:"approve"|"reject",notes?:string){
 const status=decision==="approve"?"completed":"failed";
 const r=await requireDb().query("UPDATE media_task_jobs SET status=$3,reviewed_by=$4,reviewed_at=now(),review_notes=$5,error=CASE WHEN $3='failed' THEN COALESCE($5,'Rejected during human review') ELSE NULL END,completed_at=now(),updated_at=now() WHERE project_id=$1 AND id=$2 AND status='awaiting_review' RETURNING id,project_id,status,reviewed_by,reviewed_at,review_notes",[projectId,id,status,userId,notes??null]);
 return r.rows[0]??null;
}
