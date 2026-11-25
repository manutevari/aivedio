import {requireDb} from "./db.js";
import {chooseMediaExecutionMode,type MediaTaskContract, type MediaTaskKind} from "@aivedio/core";
export async function enqueueMediaTask(projectId:string,userId:string,input:{kind:MediaTaskKind;input:Record<string,unknown>;mode?:"sync"|"async"|"stream";dependencies?:string[];requiresApproval?:boolean}){
 const mode=input.mode??chooseMediaExecutionMode({durationSeconds:Number(input.input.durationSeconds??0),interactive:input.kind==="speech.generate"&&input.input.streaming===true,batch:input.input.batch===true});
 const r=await requireDb().query("INSERT INTO media_task_jobs(project_id,kind,execution_mode,input,dependencies,created_by,status) VALUES($1,$2,$3,$4,$5::uuid[],$6,'queued') RETURNING id,project_id,kind,execution_mode,input,dependencies,status,attempt,created_at",[projectId,input.kind,mode,input.input,input.dependencies??[],userId]);
 return r.rows[0];
}
export async function getMediaTask(projectId:string,id:string){return (await requireDb().query("SELECT * FROM media_task_jobs WHERE project_id=$1 AND id=$2",[projectId,id])).rows[0]??null}
export async function listMediaTasks(projectId:string){return (await requireDb().query("SELECT id,kind,execution_mode,status,attempt,error,created_at,updated_at,completed_at FROM media_task_jobs WHERE project_id=$1 ORDER BY created_at DESC LIMIT 100",[projectId])).rows}
