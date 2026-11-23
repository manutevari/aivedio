import pg from "pg";
import {WorkerJob,validateGeneratedAsset,assessGenerationResult} from "@aivedio/core";
import {getAdapter,registeredAdapterIds} from "./adapters.js";
import {assertRoute} from "./router.js";
const {Pool}=pg;
export const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSLMODE==="require"?{rejectUnauthorized:true}:undefined});
const WORKER_ID=process.env.WORKER_ID??"aivedio-worker-"+process.pid;
const LEASE_SECONDS=Number(process.env.WORKER_LEASE_SECONDS??300);
export async function claimNextJob():Promise<WorkerJob|null>{
 const ids=registeredAdapterIds();if(!ids.length)return null;
 const client=await pool.connect();try{await client.query("BEGIN");
 await client.query(`UPDATE generation_jobs SET status='failed',error=COALESCE(error,'Worker lease expired after maximum attempts'),lease_owner=NULL,lease_expires_at=NULL,updated_at=now() WHERE provider_id=ANY($1::text[]) AND status='running' AND lease_expires_at<now() AND attempt>=max_attempts`,[ids]);
 const r=await client.query(`SELECT * FROM generation_jobs WHERE provider_id=ANY($1::text[]) AND safety_status='approved' AND ((status='queued' AND available_at<=now()) OR (status='running' AND lease_expires_at<now() AND attempt<max_attempts)) ORDER BY available_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1`,[ids]);
 if(!r.rowCount){await client.query("COMMIT");return null}
 const row=r.rows[0];const upd=await client.query("UPDATE generation_jobs SET status='running',lease_owner=$2,lease_expires_at=now()+($3||' seconds')::interval,attempt=attempt+1,started_at=COALESCE(started_at,now()),updated_at=now() WHERE id=$1 RETURNING *",[row.id,WORKER_ID,String(LEASE_SECONDS)]);
 await client.query("COMMIT");const j=upd.rows[0];return{id:j.id,projectId:j.project_id,sceneId:j.scene_id??undefined,task:j.task,providerId:j.provider_id,prompt:j.prompt,inputAssets:j.input_assets??[],parameters:j.parameters??{},status:j.status,attempt:j.attempt,maxAttempts:j.max_attempts,workerId:WORKER_ID,leaseExpiresAt:j.lease_expires_at?.toISOString(),safetyStatus:j.safety_status};
 }catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
}
async function persistAssets(client:any,job:WorkerJob,output:Awaited<ReturnType<NonNullable<ReturnType<typeof getAdapter>>["generate"]>>){
 for(const asset of output.assets){const check=validateGeneratedAsset({...asset,storageKey:asset.storageKey});if(!check.valid)throw new Error("Invalid generated asset: "+check.issues.join(", "));await client.query("INSERT INTO media_assets(project_id,scene_id,job_id,kind,status,storage_provider,storage_key,mime_type,size_bytes,checksum,metadata) VALUES($1,$2,$3,$4,'quarantined',$5,$6,$7,$8,$9,$10)",[job.projectId,job.sceneId??null,job.id,asset.kind,asset.storageProvider,asset.storageKey,asset.mimeType,asset.sizeBytes,asset.checksum??null,asset.metadata??{}]);}
}
export async function executeJob(job:WorkerJob){
 const adapter=getAdapter(job.providerId);if(!adapter)throw new Error("No reviewed provider adapter registered: "+job.providerId);
 const output=await adapter.generate(job);const quality=assessGenerationResult(output);
 const client=await pool.connect();
 try{
  await client.query("BEGIN");
  const lease=await client.query("SELECT status,lease_owner FROM generation_jobs WHERE id=$1 FOR UPDATE",[job.id]);
  if(!lease.rowCount||lease.rows[0].status!=="running"||lease.rows[0].lease_owner!==job.workerId)throw new Error("Generation worker lease lost");
  await persistAssets(client,job,output);
  const updated=await client.query("UPDATE generation_jobs SET status=$2,result=$3,quality_status=$4,lease_owner=NULL,lease_expires_at=NULL,updated_at=now(),completed_at=CASE WHEN $2='completed' THEN now() ELSE completed_at END WHERE id=$1 AND lease_owner=$5",[job.id,quality.status==="fail"?"failed":"awaiting_approval",output,quality.status,job.workerId]);
  if(updated.rowCount!==1)throw new Error("Generation worker lease lost during persistence");
  await client.query("INSERT INTO generation_reviews(job_id,stage,status,reason_codes,notes) VALUES($1,'quality',$2,$3,$4)",[job.id,quality.status,quality.findings.map(x=>x.code),JSON.stringify(quality)]);
  await client.query("COMMIT");
  return {quality,output};
 }catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
}
export async function failOrRetry(job:WorkerJob,error:unknown){
 const message=error instanceof Error?error.message:String(error);const retry=job.attempt<job.maxAttempts;
 await pool.query("UPDATE generation_jobs SET status=$2,error=$3,lease_owner=NULL,lease_expires_at=NULL,available_at=now()+($4||' seconds')::interval,updated_at=now() WHERE id=$1 AND lease_owner=$5",[job.id,retry?"queued":"failed",message,String(Math.min(300,15*2**Math.max(0,job.attempt-1))),job.workerId]);
}
