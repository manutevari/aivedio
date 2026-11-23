import {requireDb} from "./db.js";
import {normalizeExtractionRequest} from "@aivedio/core";
export async function requestAssetAnalysis(projectId:string,assetId:string,kinds:unknown){
 const db=requireDb();const a=await db.query("SELECT id,project_id,status,kind FROM media_assets WHERE id=$1 AND project_id=$2",[assetId,projectId]);if(!a.rowCount)throw new Error("Asset not found in project");if(a.rows[0].status==="deleted")throw new Error("Deleted asset cannot be analyzed");
 const requested=normalizeExtractionRequest(kinds);const job=await db.query("INSERT INTO asset_analysis_jobs(asset_id,project_id,requested_kinds) VALUES($1,$2,$3) RETURNING *",[assetId,projectId,requested]);
 await db.query("UPDATE media_assets SET analysis_status='queued' WHERE id=$1",[assetId]);return job.rows[0];
}
export async function listAssetAnalysis(projectId:string,assetId?:string){if(assetId)return(await requireDb().query("SELECT * FROM asset_analysis_jobs WHERE project_id=$1 AND asset_id=$2 ORDER BY created_at DESC LIMIT 50",[projectId,assetId])).rows;return(await requireDb().query("SELECT * FROM asset_analysis_jobs WHERE project_id=$1 ORDER BY created_at DESC LIMIT 100",[projectId])).rows}
export async function getAssetAnalysis(projectId:string,id:string){return(await requireDb().query("SELECT * FROM asset_analysis_jobs WHERE project_id=$1 AND id=$2",[projectId,id])).rows[0]??null}
export async function getAssetIntelligence(projectId:string,assetId:string){
 const db=requireDb();const a=await db.query("SELECT * FROM media_assets WHERE project_id=$1 AND id=$2",[projectId,assetId]);if(!a.rowCount)throw new Error("Asset not found");
 const [extracts,chunks,keyframes]=await Promise.all([db.query("SELECT * FROM asset_extractions WHERE asset_id=$1 ORDER BY created_at DESC",[assetId]),db.query("SELECT * FROM media_chunks WHERE asset_id=$1 ORDER BY ordinal,page,start_seconds",[assetId]),db.query("SELECT * FROM media_keyframes WHERE asset_id=$1 ORDER BY timestamp_seconds",[assetId])]);
 return{asset:a.rows[0],extractions:extracts.rows,chunks:chunks.rows,keyframes:keyframes.rows};
}
export async function searchMediaChunks(projectId:string,q:string,limit=10){if(!q.trim())return[];const n=Math.max(1,Math.min(50,Math.floor(limit)||10));return(await requireDb().query("SELECT c.*,ts_rank(c.search_vector,websearch_to_tsquery('simple',$2)) rank,a.original_name,a.kind asset_kind,a.mime_type FROM media_chunks c JOIN media_assets a ON a.id=c.asset_id WHERE c.project_id=$1 AND c.search_vector @@ websearch_to_tsquery('simple',$2) ORDER BY rank DESC,created_at DESC LIMIT $3",[projectId,q,n])).rows}
export async function listKeyframes(projectId:string,assetId:string){return(await requireDb().query("SELECT * FROM media_keyframes WHERE project_id=$1 AND asset_id=$2 ORDER BY timestamp_seconds",[projectId,assetId])).rows}
export async function deleteAssetIntelligence(projectId:string,assetId:string){const r=await requireDb().query("DELETE FROM media_assets WHERE project_id=$1 AND id=$2 RETURNING id",[projectId,assetId]);return Boolean(r.rowCount)}
