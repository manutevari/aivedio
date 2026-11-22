import {requireDb} from "./db.js";
import {ContinuitySnapshot,evaluateContinuity,buildQaReport,unavailableSafetyReview,decideQaAction,QaReport,SafetyReview} from "@aivedio/core";
export async function createAssetQualityJob(projectId:string,assetId:string,expectedProfile:Record<string,unknown>={},requestedBy?:string){
 const db=requireDb();const r=await db.query("SELECT id,status FROM media_assets WHERE id=$1 AND project_id=$2",[assetId,projectId]);if(!r.rowCount)throw new Error("Asset not found in project");if(r.rows[0].status==="deleted")throw new Error("Deleted assets cannot be quality checked");
 return(await db.query("INSERT INTO quality_jobs(project_id,asset_id,expected_profile,requested_by) VALUES($1,$2,$3,$4) RETURNING *",[projectId,assetId,expectedProfile,requestedBy??null])).rows[0]
}
export async function listQualityJobs(projectId:string){return(await requireDb().query("SELECT * FROM quality_jobs WHERE project_id=$1 ORDER BY created_at DESC LIMIT 100",[projectId])).rows}
export async function listQualityReports(projectId:string,assetId?:string){if(assetId)return(await requireDb().query("SELECT * FROM quality_reports WHERE project_id=$1 AND asset_id=$2 ORDER BY created_at DESC LIMIT 100",[projectId,assetId])).rows;return(await requireDb().query("SELECT * FROM quality_reports WHERE project_id=$1 ORDER BY created_at DESC LIMIT 100",[projectId])).rows}
export async function getQualityReport(projectId:string,id:string){return(await requireDb().query("SELECT * FROM quality_reports WHERE project_id=$1 AND id=$2",[projectId,id])).rows[0]??null}
export async function runContinuityReview(projectId:string,snapshots:ContinuitySnapshot[]){
 if(!Array.isArray(snapshots)||snapshots.length>500)throw new Error("Snapshots must be an array of at most 500 scenes");
 const findings=evaluateContinuity(snapshots);const report=buildQaReport(findings,{sceneCount:snapshots.length,comparisonCount:Math.max(0,snapshots.length-1)});
 const safety=unavailableSafetyReview("asset","No visual safety classifier configured");const decision=decideQaAction(report,safety);
 const r=await requireDb().query("INSERT INTO quality_reports(project_id,stage,status,score,action,safety_verdict,report) VALUES($1,'continuity',$2,$3,$4,$5,$6) RETURNING *",[projectId,report.status,report.score,decision.action,safety.verdict,{...report,safety,decision}]);
 await requireDb().query("INSERT INTO safety_reviews(project_id,report_id,stage,verdict,reason_codes,policy_version) VALUES($1,$2,$3,$4,$5,$6)",[projectId,r.rows[0].id,safety.stage,safety.verdict,safety.reasonCodes,safety.policyVersion]);
 return r.rows[0]
}
export async function applySafetyReview(projectId:string,reportId:string,input:{decision:"clear"|"block"|"needs_changes";reviewer:string;notes:string}){
 if(!input.reviewer?.trim()||!input.notes?.trim())throw new Error("Reviewer and review notes are required");
 const db=requireDb(),client=await db.connect();try{await client.query("BEGIN");
 const q=await client.query("SELECT * FROM quality_reports WHERE id=$1 AND project_id=$2 FOR UPDATE",[reportId,projectId]);if(!q.rowCount)throw new Error("Quality report not found");
 const current=q.rows[0];const report=current.report as QaReport;const prior=current.safety_verdict as string;
 if(prior==="violation"&&input.decision==="clear")throw new Error("Confirmed safety violations cannot be cleared by this review endpoint");
 if(prior==="violation"&&input.decision!=="block")throw new Error("Confirmed safety violations remain blocked");
 const verdict=input.decision==="clear"?"clear":input.decision==="block"?"violation":"uncertain";
 const safety:SafetyReview={verdict,stage:"asset",policyVersion:"phase13-human-review-v1",reasonCodes:[input.decision==="clear"?"HUMAN_REVIEW_CLEARED":input.decision==="block"?"HUMAN_REVIEW_BLOCKED":"CHANGES_REQUIRED"],confidence:1,reviewRequired:input.decision!=="clear",createdAt:new Date().toISOString()};
 const decision=decideQaAction(report,safety);
 const update=await client.query("UPDATE quality_reports SET safety_verdict=$2,action=$3,report=report||$4::jsonb WHERE id=$1 RETURNING *",[reportId,verdict,decision.action,JSON.stringify({safety,decision})]);
 await client.query("INSERT INTO safety_reviews(project_id,asset_id,report_id,stage,verdict,reason_codes,confidence,policy_version,reviewed_by,review_notes,reviewed_at) VALUES($1,$2,$3,'asset',$4,$5,1,$6,$7,$8,now())",[projectId,current.asset_id,reportId,verdict,safety.reasonCodes,safety.policyVersion,input.reviewer,input.notes]);
 await client.query("COMMIT");return update.rows[0]
 }catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
}
export async function listSafetyReviews(projectId:string){return(await requireDb().query("SELECT * FROM safety_reviews WHERE project_id=$1 ORDER BY created_at DESC LIMIT 100",[projectId])).rows}
