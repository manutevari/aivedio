export type QaSeverity="info"|"warning"|"error"|"critical";
export type QaStatus="pass"|"warning"|"fail"|"needs_review"|"not_run";
export type QaAction="CONTINUE"|"AUTO_REPAIR"|"HITL_REVIEW"|"BLOCK";
export type SafetyVerdict="clear"|"uncertain"|"violation"|"unavailable";
export interface QaFinding{code:string;category:"technical"|"continuity"|"safety"|"compliance";severity:QaSeverity;message:string;confidence:number;assetId?:string;sceneId?:string;recommendedRepair?:string;metadata?:Record<string,unknown>}
export interface QaReport{status:QaStatus;score:number;findings:QaFinding[];metrics:Record<string,number|string|boolean|null>;createdAt:string}
export interface SafetyReview{verdict:SafetyVerdict;stage:"input"|"script"|"prompt"|"asset"|"generation"|"edit"|"render"|"final";policyVersion:string;reasonCodes:string[];confidence:number|null;reviewRequired:boolean;createdAt:string}
export interface ContinuitySnapshot{sceneId:string;sceneOrder:number;attributes:Record<string,string|number|boolean|null>}
export interface TechnicalMediaProfile{kind:"image"|"video"|"audio"|"document";mimeType:string;width?:number;height?:number;fps?:number;durationSeconds?:number;hasAudio?:boolean;hasVideo?:boolean;audioSampleRate?:number;audioChannels?:number;blackFrameSeconds?:number[];frozenIntervals?:Array<{start:number;duration:number}>;silenceIntervals?:Array<{start:number;duration:number}>;fileReadable:boolean}
const severityWeight:Record<QaSeverity,number>={info:0,warning:5,error:18,critical:40};
export function evaluateContinuity(snapshots:ContinuitySnapshot[]):QaFinding[]{
 const findings:QaFinding[]=[];const ordered=[...snapshots].sort((a,b)=>a.sceneOrder-b.sceneOrder);
 for(let i=1;i<ordered.length;i++){const prev=ordered[i-1]!,next=ordered[i]!;for(const [key,value] of Object.entries(prev.attributes)){if(value===null||value===undefined||!(key in next.attributes))continue;const nextValue=next.attributes[key];if(nextValue===null||nextValue===undefined)continue;if(String(value)!==String(nextValue)){const criticalKey=/identity|character.*appearance|wardrobe|signature_prop/i.test(key);findings.push({code:"CONTINUITY_MISMATCH",category:"continuity",severity:criticalKey?"error":"warning",message:`Continuity attribute "${key}" differs between scene ${prev.sceneOrder} and scene ${next.sceneOrder}.`,confidence:1,sceneId:next.sceneId,recommendedRepair:"Review the reference sheet and align the later scene, unless the change is intentional.",metadata:{attribute:key,previous:value,current:nextValue,previousSceneId:prev.sceneId}})}}}
 return findings;
}
export function evaluateTechnicalMedia(profile:TechnicalMediaProfile,expected?:{width?:number;height?:number;fps?:number;minDurationSeconds?:number;maxDurationSeconds?:number}):QaFinding[]{
 const f:QaFinding[]=[];const add=(code:string,severity:QaSeverity,message:string,repair:string,metadata:Record<string,unknown>={})=>f.push({code,category:"technical",severity,message,confidence:1,recommendedRepair:repair,metadata});
 if(!profile.fileReadable)add("FILE_UNREADABLE","critical","Media file could not be read.","Re-upload or regenerate the asset.");
 if(profile.kind==="video"||profile.kind==="image"){
  if(!profile.width||!profile.height)add("DIMENSIONS_UNKNOWN","warning","Image/video dimensions are unavailable.","Run a supported metadata probe.");
  if(expected?.width&&profile.width&&profile.width!==expected.width)add("WIDTH_MISMATCH","warning",`Expected width ${expected.width}px but found ${profile.width}px.`,"Reframe or render to the requested width.",{expected:expected.width,actual:profile.width});
  if(expected?.height&&profile.height&&profile.height!==expected.height)add("HEIGHT_MISMATCH","warning",`Expected height ${expected.height}px but found ${profile.height}px.`,"Reframe or render to the requested height.",{expected:expected.height,actual:profile.height});
 }
 if(profile.kind==="video"){
  if(!profile.fps)add("FPS_UNKNOWN","warning","Frame rate is unavailable.","Probe the source or normalize frame rate at render.");
  if(expected?.fps&&profile.fps&&Math.abs(profile.fps-expected.fps)>.05)add("FPS_MISMATCH","warning",`Expected ${expected.fps} fps but found ${profile.fps} fps.`,"Normalize frame rate during render.");
  if((profile.blackFrameSeconds??[]).length)add("BLACK_FRAMES","error","Potential black frames were detected.","Inspect detected timestamps and replace or trim affected frames.",{timestamps:profile.blackFrameSeconds});
  if((profile.frozenIntervals??[]).some(x=>x.duration>=2))add("FROZEN_VIDEO","warning","A frozen interval of at least two seconds was detected.","Check intentional holds; otherwise regenerate or trim the interval.",{intervals:profile.frozenIntervals});
 }
 if(profile.kind==="audio"||profile.hasAudio){
  if(profile.audioChannels===0)add("NO_AUDIO_CHANNELS","warning","No audio channels were detected.","Check source selection and audio export.");
  if((profile.silenceIntervals??[]).some(x=>x.duration>=5))add("LONG_SILENCE","warning","A silence interval of at least five seconds was detected.","Check dialogue, ambience and music coverage.",{intervals:profile.silenceIntervals});
 }
 if(expected?.minDurationSeconds!==undefined&&profile.durationSeconds!==undefined&&profile.durationSeconds<expected.minDurationSeconds)add("DURATION_TOO_SHORT","error","Media is shorter than the configured minimum duration.","Extend or regenerate the missing section.");
 if(expected?.maxDurationSeconds!==undefined&&profile.durationSeconds!==undefined&&profile.durationSeconds>expected.maxDurationSeconds)add("DURATION_TOO_LONG","warning","Media exceeds the configured maximum duration.","Trim the output to the target duration.");
 return f;
}
export function buildQaReport(findings:QaFinding[],metrics:QaReport["metrics"]={}):QaReport{
 const penalty=findings.reduce((n,x)=>n+severityWeight[x.severity],0);const score=Math.max(0,Math.min(100,100-penalty));
 const status:QaStatus=findings.some(x=>x.severity==="critical"||x.severity==="error")?"fail":findings.some(x=>x.severity==="warning")?"warning":"pass";
 return{status,score,findings,metrics,createdAt:new Date().toISOString()};
}
export function decideQaAction(report:QaReport,safety:SafetyReview):{action:QaAction;reasons:string[]}{
 if(safety.verdict==="violation")return{action:"BLOCK",reasons:["Confirmed safety violation"]};
 if(safety.verdict==="unavailable"||safety.verdict==="uncertain"||safety.reviewRequired)return{action:"HITL_REVIEW",reasons:["Safety has not been authoritatively cleared"]};
 if(report.findings.some(f=>f.severity==="critical"))return{action:"BLOCK",reasons:["Critical quality or technical defect"]};
 if(report.findings.some(f=>f.severity==="error"))return{action:"AUTO_REPAIR",reasons:["Repairable technical/continuity errors detected"]};
 if(report.findings.some(f=>f.severity==="warning"))return{action:"HITL_REVIEW",reasons:["Warnings require human judgement"]};
 return{action:"CONTINUE",reasons:["No blocking QA findings and safety is clear"]};
}
export function unavailableSafetyReview(stage:SafetyReview["stage"],reason="No production safety classifier configured"):SafetyReview{return{verdict:"unavailable",stage,policyVersion:"phase13-placeholder-v1",reasonCodes:[reason],confidence:null,reviewRequired:true,createdAt:new Date().toISOString()}}
