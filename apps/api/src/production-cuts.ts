import {requireDb} from "./db.js";
import {CreativePlan,CreativeScriptContent,ProductionCutDraft,buildProductionCut,validateProductionCutForApply,defaultRenderProfile,dbToEditManifest,validateEditManifest} from "@aivedio/core";
import {getTimeline} from "./timeline.js";
import {listSubtitles,getMixSettings} from "./editing.js";

type AssetRow={id:string;kind:string;status:string;metadata:Record<string,unknown>;duration_seconds:number|null;generation_safety_status:string|null;quality_status:string|null;latest_qa_status:string|null;latest_safety_verdict:string|null;created_at:string};
const assetSelect=`SELECT a.id,a.kind,a.status,COALESCE(a.metadata,'{}'::jsonb) metadata,
 CASE WHEN COALESCE(a.metadata->>'durationSeconds',a.metadata #>> '{probe,format,duration}') ~ '^[0-9]+(\\.[0-9]+)?$' THEN COALESCE(a.metadata->>'durationSeconds',a.metadata #>> '{probe,format,duration}')::numeric ELSE NULL END duration_seconds,
 g.safety_status generation_safety_status,g.quality_status,
 q.status latest_qa_status,q.safety_verdict latest_safety_verdict,a.created_at
 FROM media_assets a
 LEFT JOIN generation_jobs g ON g.id=a.job_id
 LEFT JOIN LATERAL (SELECT status,safety_verdict FROM quality_reports WHERE asset_id=a.id ORDER BY created_at DESC LIMIT 1) q ON true
 WHERE a.project_id=$1 AND a.status<>'deleted' ORDER BY a.created_at DESC`;
function asCandidate(a:AssetRow){return{id:a.id,kind:a.kind,status:a.status,metadata:a.metadata??{},durationSeconds:a.duration_seconds===null?null:Number(a.duration_seconds),generationSafetyStatus:a.generation_safety_status,qualityStatus:a.quality_status,latestQaStatus:a.latest_qa_status,latestSafetyVerdict:a.latest_safety_verdict}}
function jsonObject(value:unknown){return value&&typeof value==="object"?value as Record<string,any>:{}}
export async function createProductionCut(projectId:string,input:{scriptPackageId:string;assetAssignments?:Record<string,string>;createdBy?:string}){
 if(!input.scriptPackageId?.trim())throw new Error("scriptPackageId is required");
 const db=requireDb(),client=await db.connect();
 try{
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[projectId]);
  const source=await client.query("SELECT p.id plan_id,p.status plan_status,p.plan,c.id script_package_id,c.status script_status,c.content script_content,c.validation script_validation,c.pricing_free_verified FROM creative_script_packages c JOIN creative_plans p ON p.id=c.plan_id AND p.project_id=c.project_id WHERE c.project_id=$1 AND c.id=$2 FOR SHARE OF c,p",[projectId,input.scriptPackageId]);
  if(!source.rowCount)throw new Error("Script package not found in this project");
  const row=source.rows[0];
  if(row.plan_status!=="approved")throw new Error("Creative plan must be approved before timeline assembly");
  if(row.script_status!=="approved")throw new Error("Script package must be approved before timeline assembly");
  if(row.pricing_free_verified!==true)throw new Error("Script package does not have verified free-model provenance");\n  if(!row.script_validation||row.script_validation.valid!==true)throw new Error("Script package validation must be successful before timeline assembly");
  const assetRows=(await client.query(assetSelect,[projectId])).rows as AssetRow[];
  const plan=row.plan as CreativePlan;const script=row.script_content as CreativeScriptContent;
  const draft=buildProductionCut(plan,script,row.script_package_id,assetRows.map(asCandidate),{assetAssignments:input.assetAssignments??{}});
  const version=Number((await client.query("SELECT COALESCE(MAX(version),0)+1 AS version FROM production_cuts WHERE project_id=$1",[projectId])).rows[0].version);
  const audioPlan={musicArc:script.musicArc??[],soundDesign:script.soundDesign??[]};
  const screenplay={scenes:(script.scenes??[]).map(s=>({sceneId:s.sceneId,slugline:s.slugline,durationSeconds:s.durationSeconds,onScreenText:s.onScreenText??[],dialogue:s.dialogue??[]}))};
  const content={...draft,audioPlan,screenplay};
  const inserted=await client.query("INSERT INTO production_cuts(project_id,plan_id,script_package_id,version,status,readiness,readiness_score,target_duration_ms,content,created_by) VALUES($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9) RETURNING *",[projectId,row.plan_id,row.script_package_id,version,draft.readiness,draft.readinessScore,draft.targetDurationMs,JSON.stringify(content),input.createdBy??null]);
  await client.query("COMMIT");return inserted.rows[0];
 }catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
}
export async function listProductionCuts(projectId:string){
 return(await requireDb().query("SELECT id,project_id,plan_id,script_package_id,version,status,readiness,readiness_score,target_duration_ms,created_by,created_at,applied_at FROM production_cuts WHERE project_id=$1 ORDER BY version DESC LIMIT 100",[projectId])).rows
}
export async function getProductionCut(projectId:string,id:string){
 return(await requireDb().query("SELECT * FROM production_cuts WHERE project_id=$1 AND id=$2",[projectId,id])).rows[0]??null
}
export async function applyProductionCut(projectId:string,id:string){
 const db=requireDb(),client=await db.connect();
 try{
  await client.query("BEGIN");
  const found=await client.query("SELECT * FROM production_cuts WHERE project_id=$1 AND id=$2 FOR UPDATE",[projectId,id]);
  if(!found.rowCount)throw new Error("Production cut not found");
  const cut=found.rows[0];if(cut.status!=="draft")throw new Error("Only a draft production cut can be applied");
  const approvals=await client.query("SELECT p.status plan_status,s.status script_status,s.pricing_free_verified,s.validation FROM creative_plans p JOIN creative_script_packages s ON s.plan_id=p.id AND s.project_id=p.project_id WHERE p.project_id=$1 AND p.id=$2 AND s.id=$3 FOR SHARE OF p,s",[projectId,cut.plan_id,cut.script_package_id]);
  if(!approvals.rowCount||approvals.rows[0].plan_status!=="approved"||approvals.rows[0].script_status!=="approved"||approvals.rows[0].pricing_free_verified!==true||approvals.rows[0].validation?.valid!==true)throw new Error("Plan/script approval or validation is no longer valid");
  const content=jsonObject(cut.content) as ProductionCutDraft;
  const validation=validateProductionCutForApply(content);
  if(!validation.valid)throw new Error(validation.errors.join("; "));
  const assetIds=[...new Set(content.items.map(x=>x.assetId).filter((x):x is string=>Boolean(x)))];
  if(!assetIds.length)throw new Error("No released visual assets are assigned");
  const readiness=await client.query(`SELECT a.id,a.kind,a.status,g.safety_status,
   q.status qa_status,q.safety_verdict
   FROM media_assets a
   LEFT JOIN generation_jobs g ON g.id=a.job_id
   LEFT JOIN LATERAL (SELECT status,safety_verdict FROM quality_reports WHERE asset_id=a.id ORDER BY created_at DESC LIMIT 1) q ON true
   WHERE a.project_id=$1 AND a.id=ANY($2::uuid[]) FOR UPDATE OF a`,[projectId,assetIds]);
  const byId=new Map(readiness.rows.map((a:any)=>[a.id,a]));
  for(const item of content.items){
   const a=item.assetId?byId.get(item.assetId) as any:undefined;
   if(!a||a.status!=="ready"||a.safety_status!=="approved"||!["pass","warning"].includes(a.qa_status)||a.safety_verdict!=="clear")
    throw new Error("Shot "+item.shotId+" no longer satisfies release, technical QA and safety review gates");
   if(a.kind!==item.assetKind)throw new Error("Shot "+item.shotId+" asset type changed after cut compilation");
  }
  const maxOrder=Number((await client.query("SELECT COALESCE(MAX(track_order),-1)+1 AS n FROM timeline_tracks WHERE project_id=$1",[projectId])).rows[0].n);
  const track=(await client.query("INSERT INTO timeline_tracks(project_id,name,kind,track_order,metadata) VALUES($1,$2,'video',$3,$4) RETURNING *",[projectId,"Main Video — Cut v"+cut.version,maxOrder,{productionCutId:id,version:cut.version,nonDestructive:true}])).rows[0];
  const clipIds:string[]=[];
  for(const item of content.items){
   const kind="video";
   const result=await client.query(`INSERT INTO timeline_clips(track_id,asset_id,kind,title,timeline_start_ms,timeline_duration_ms,source_start_ms,source_duration_ms,playback_rate,volume,opacity,z_index,metadata)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,1,1,$9,$10) RETURNING id`,[track.id,item.assetId,kind,item.title,item.timelineStartMs,item.timelineDurationMs,item.sourceStartMs,item.timelineDurationMs,item.shotOrder,JSON.stringify({productionCutId:id,planId:cut.plan_id,scriptPackageId:cut.script_package_id,sceneId:item.sceneId,shotId:item.shotId,sourceAssetKind:item.assetKind,prompt:item.prompt,negativePrompt:item.negativePrompt,qaGated:true})]);
   clipIds.push(result.rows[0].id);
  }
  const updatedContent={...content,appliedTrackId:track.id,appliedClipIds:clipIds};
  const updated=await client.query("UPDATE production_cuts SET status='applied',content=$3,applied_at=now(),updated_at=now() WHERE project_id=$1 AND id=$2 RETURNING *",[projectId,id,JSON.stringify(updatedContent)]);
  await client.query("INSERT INTO edit_decisions(project_id,kind,target_id,parameters) VALUES($1,'overlay',$2,$3)",[projectId,id,{action:"apply_production_cut",trackId:track.id,clipIds,version:cut.version}]);
  await client.query("COMMIT");
  return{cut:updated.rows[0],trackId:track.id,clipIds,createdClips:clipIds.length};
 }catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
}
export async function getTimelineEditManifest(projectId:string){
 const db=requireDb();const {tracks,clips}=await getTimeline(projectId);const subtitles=await listSubtitles(projectId);const settings=await getMixSettings(projectId);
 const transitions:Record<string,{type:any;durationMs:number}>={};
 for(const clip of clips){
  if(clip.transitionIn){const allowed=["cut","fade","dissolve","wipeleft","wiperight","slideleft","slideright"];const type=allowed.includes(clip.transitionIn)?clip.transitionIn:"cut";transitions[clip.id]={type:type as any,durationMs:type==="cut"?0:Number((clip.metadata as any)?.transitionInDurationMs??500)}}
 }
 const manifest=dbToEditManifest(projectId,defaultRenderProfile,tracks,clips,transitions,subtitles);
 manifest.audioMix=settings.map((s:any)=>({trackId:s.track_id,gainDb:Number(s.gain_db),muted:Boolean(s.muted),ducking:s.ducking??undefined}));
 const validation=validateEditManifest(manifest);
 return{manifest,validation,sourceCounts:{tracks:tracks.length,clips:clips.length,subtitles:subtitles.length},renderReady:validation.valid};
}
