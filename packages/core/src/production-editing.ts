import type {CreativePlan} from "./creative-director.js";
import type {CreativeScriptContent} from "./scriptwriting.js";

export type ProductionAssetState="ready"|"needs_review"|"missing_asset";
export interface ProductionAssetCandidate{
 id:string;kind:string;status:string;metadata:Record<string,unknown>;durationSeconds?:number|null;
 generationSafetyStatus?:string|null;qualityStatus?:string|null;latestQaStatus?:string|null;latestSafetyVerdict?:string|null;
}
export interface ProductionCutItem{
 id:string;shotId:string;sceneId:string;sceneOrder:number;shotOrder:number;title:string;prompt:string;negativePrompt:string;
 timelineStartMs:number;timelineDurationMs:number;sourceStartMs:number;sourceDurationMs:number;
 assetId:string|null;assetKind:string|null;assetState:ProductionAssetState;readinessReasons:string[];
}
export interface ProductionCutDraft{
 title:string;planId:string;scriptPackageId:string;targetDurationMs:number;readinessScore:number;
 readiness:"ready"|"incomplete"|"review_required";items:ProductionCutItem[];warnings:string[];
 createdAt:string;
}
export interface BuildProductionCutOptions{assetAssignments?:Record<string,string>}

function candidateReady(a:ProductionAssetCandidate):string[]{
 const reasons:string[]=[];
 if(a.status!=="ready")reasons.push("ASSET_NOT_RELEASED");
 if(a.generationSafetyStatus!=="approved")reasons.push("GENERATION_SAFETY_NOT_APPROVED");
 if(!a.latestQaStatus)reasons.push("TECHNICAL_QA_NOT_RUN");
 else if(!["pass","warning"].includes(a.latestQaStatus))reasons.push("TECHNICAL_QA_NOT_PASSED");
 if(a.latestSafetyVerdict!=="clear")reasons.push("SAFETY_NOT_CLEARED");
 if(!["video","image"].includes(a.kind))reasons.push("UNSUPPORTED_VISUAL_ASSET_KIND");
 return reasons;
}
function matchingAssets(candidates:ProductionAssetCandidate[],shotId:string,sceneId:string){
 const byShot=candidates.filter(a=>a.metadata?.shotId===shotId);
 if(byShot.length)return byShot;
 return candidates.filter(a=>a.metadata?.planSceneId===sceneId||a.metadata?.scriptSceneId===sceneId);
}
export function buildProductionCut(plan:CreativePlan,script:CreativeScriptContent,scriptPackageId:string,candidates:ProductionAssetCandidate[],options:BuildProductionCutOptions={}):ProductionCutDraft{
 if(!plan?.scenes?.length)throw new Error("Approved creative plan has no scenes");
 const scriptScenes=new Map(script.scenes.map(s=>[s.sceneId,s]));
 const scriptShots=new Map(script.shots.map(s=>[s.shotId,s]));
 const items:ProductionCutItem[]=[];const warnings:string[]=[];let sceneStartMs=0;
 for(const scene of [...plan.scenes].sort((a,b)=>a.order-b.order)){
  const scriptScene=scriptScenes.get(scene.id);
  if(!scriptScene)throw new Error("Approved script is missing plan scene "+scene.id);
  if(Math.abs(scriptScene.durationSeconds-scene.durationSeconds)>1)warnings.push("SCRIPT_DURATION_DIFFERS:"+scene.id);
  const shots=[...scene.shots].sort((a,b)=>a.order-b.order);
  if(!shots.length)throw new Error("Scene "+scene.id+" has no planned shots");
  const totalShotSeconds=shots.reduce((n,s)=>n+s.durationSeconds,0);
  if(totalShotSeconds<=0)throw new Error("Scene "+scene.id+" has invalid shot durations");
  let usedMs=0;
  for(let i=0;i<shots.length;i++){
   const plannedShot=shots[i]!;
   const endMs=i===shots.length-1?Math.round(scene.durationSeconds*1000):Math.round((shots.slice(0,i+1).reduce((n,s)=>n+s.durationSeconds,0)/totalShotSeconds)*scene.durationSeconds*1000);
   const durationMs=endMs-usedMs;
   const prompt=scriptShots.get(plannedShot.id);
   if(!prompt||prompt.sceneId!==scene.id)throw new Error("Validated script shot missing or assigned to another scene: "+plannedShot.id);
   let candidate:ProductionAssetCandidate|undefined;
   const explicitId=options.assetAssignments?.[plannedShot.id];
   if(explicitId){
    candidate=candidates.find(a=>a.id===explicitId);
    if(!candidate)throw new Error("Assigned asset is not part of this project: "+explicitId);
   }else{
    const matches=matchingAssets(candidates,plannedShot.id,scene.id);
    if(matches.length===1)candidate=matches[0];
    else if(matches.length>1)warnings.push("AMBIGUOUS_ASSET_MATCH:"+plannedShot.id);
   }
   const reasons=candidate?candidateReady(candidate):[];
   if(!candidate)reasons.push(options.assetAssignments?.[plannedShot.id]?"ASSIGNED_ASSET_UNAVAILABLE":"ASSET_NOT_FOUND");
   if(candidate?.durationSeconds&&candidate.durationSeconds*1000+100<durationMs)reasons.push("SOURCE_TOO_SHORT");
   const state:ProductionAssetState=!candidate?"missing_asset":reasons.length?"needs_review":"ready";
   if(state==="missing_asset")warnings.push("MISSING_ASSET:"+plannedShot.id);
   if(state==="needs_review")warnings.push("ASSET_REVIEW_REQUIRED:"+plannedShot.id);
   const sourceDurationMs=candidate?.durationSeconds?Math.round(candidate.durationSeconds*1000):durationMs;
   items.push({
    id:plannedShot.id,shotId:plannedShot.id,sceneId:scene.id,sceneOrder:scene.order,shotOrder:plannedShot.order,
    title:scene.title+" — Shot "+plannedShot.order,prompt:prompt.generationPrompt,negativePrompt:prompt.negativePrompt??"",
    timelineStartMs:sceneStartMs+usedMs,timelineDurationMs:durationMs,sourceStartMs:0,sourceDurationMs,
    assetId:candidate?.id??null,assetKind:candidate?.kind??null,assetState:state,readinessReasons:reasons
   });
   usedMs=endMs;
  }
  sceneStartMs+=Math.round(scene.durationSeconds*1000);
 }
 const readyCount=items.filter(x=>x.assetState==="ready").length;
 const readinessScore=items.length?Math.round(readyCount/items.length*100):0;
 const readiness=readyCount===items.length?"ready":items.some(x=>x.assetState==="needs_review")?"review_required":"incomplete";
 return{title:plan.projectTitle+" — Production Cut",planId:plan.id,scriptPackageId,targetDurationMs:Math.round(plan.targetDurationSeconds*1000),readinessScore,readiness,items,warnings:[...new Set(warnings)],createdAt:new Date().toISOString()};
}
export function validateProductionCutForApply(cut:ProductionCutDraft){
 const errors:string[]=[];
 if(!cut.items.length)errors.push("Production cut contains no shot items");
 const blocked=cut.items.filter(x=>x.assetState!=="ready");
 if(blocked.length)errors.push(blocked.length+" shot(s) are missing released assets or require QA/safety review");
 for(const item of cut.items)if(item.timelineDurationMs<=0||item.timelineStartMs<0)errors.push("Invalid timing for shot "+item.shotId);
 const ordered=[...cut.items].sort((a,b)=>a.timelineStartMs-b.timelineStartMs);
 for(let i=1;i<ordered.length;i++)if(ordered[i]!.timelineStartMs<ordered[i-1]!.timelineStartMs+ordered[i-1]!.timelineDurationMs)errors.push("Overlapping shot placements detected");
 return{valid:errors.length===0,errors};
}
