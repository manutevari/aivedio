export type AudioCueKind="dialogue"|"narration"|"music"|"ambience"|"sfx";
export type AudioCueState="ready"|"needs_asset"|"needs_timing"|"needs_review";
export type AudioTimingConfidence="manual"|"estimated"|"unconfirmed";
export interface AudioCueDraft{
 id:string;kind:AudioCueKind;sceneId:string;sceneOrder:number;title:string;text?:string;speaker?:string;
 startMs:number|null;durationMs:number|null;timingConfidence:AudioTimingConfidence;
 assetId:string|null;assetState:AudioCueState;readinessReasons:string[];
 gainDb:number;fadeInMs:number;fadeOutMs:number;duckingTarget?:"dialogue"|"none";
 sourceStartMs:number;sourceDurationMs:number|null;metadata:Record<string,unknown>;
}
export interface AudioAssetCandidate{
 id:string;kind:string;status:string;metadata:Record<string,unknown>;durationSeconds?:number|null;
 generationSafetyStatus?:string|null;latestQaStatus?:string|null;latestSafetyVerdict?:string|null;
}
export interface AudioProductionPlan{
 title:string;productionCutId:string;scriptPackageId:string;targetDurationMs:number;readinessScore:number;
 readiness:"ready"|"incomplete"|"review_required";cues:AudioCueDraft[];warnings:string[];createdAt:string;
}
export interface AudioAnalysisMetrics{
 durationSeconds:number|null;sampleRate:number|null;channels:number|null;integratedLufs:number|null;
 loudnessRangeLufs:number|null;truePeakDbtp:number|null;samplePeakDbfs:number|null;rmsDbfs:number|null;
 clippingSamples:number|null;silenceIntervals:Array<{start:number;end:number;duration:number}>;syncOffsetMs:number|null;
 analysisAvailable:boolean;warnings:string[];
}
export interface AudioQaThresholds{
 maxTruePeakDbtp?:number;maxSilenceSeconds?:number;minRmsDbfs?:number;maxClippingSamples?:number;
}
export interface AudioQaFinding{code:string;severity:"info"|"warning"|"error";message:string;confidence:number;metadata?:Record<string,unknown>}
const audioAssetReasons=(a:AudioAssetCandidate):string[]=>{
 const r:string[]=[];
 if(a.kind!=="audio")r.push("NOT_AUDIO_ASSET");
 if(a.status!=="ready")r.push("ASSET_NOT_RELEASED");
 if(a.generationSafetyStatus!=="approved")r.push("GENERATION_SAFETY_NOT_APPROVED");
 if(!a.latestQaStatus)r.push("AUDIO_QA_NOT_RUN");
 else if(!["pass","warning"].includes(a.latestQaStatus))r.push("AUDIO_QA_NOT_PASSED");
 if(a.latestSafetyVerdict!=="clear")r.push("SAFETY_NOT_CLEARED");
 return r;
};
export function validateAudioCue(c:AudioCueDraft,targetDurationMs:number){
 const errors:string[]=[];
 if(!c.id.trim()||!c.sceneId.trim())errors.push("Cue id and scene id are required");
 if(c.startMs!==null&&(!Number.isFinite(c.startMs)||c.startMs<0))errors.push("Cue start must be non-negative");
 if(c.durationMs!==null&&(!Number.isFinite(c.durationMs)||c.durationMs<=0))errors.push("Cue duration must be positive");
 if(c.startMs!==null&&c.durationMs!==null&&c.startMs+c.durationMs>targetDurationMs+50)errors.push("Cue exceeds production duration");
 if(c.gainDb< -60||c.gainDb>12||!Number.isFinite(c.gainDb))errors.push("Cue gain must be between -60 and +12 dB");
 if(c.fadeInMs<0||c.fadeOutMs<0||!Number.isFinite(c.fadeInMs)||!Number.isFinite(c.fadeOutMs))errors.push("Fade durations must be non-negative");
 if(c.durationMs!==null&&c.fadeInMs+c.fadeOutMs>c.durationMs)errors.push("Combined fades exceed cue duration");
 return{valid:errors.length===0,errors};
}
export function buildAudioProductionPlan(input:{
 productionCutId:string;scriptPackageId:string;targetDurationMs:number;
 scenes:Array<{id:string;order:number;startMs:number;durationMs:number;dialogue:Array<{speaker:string;line:string;kind:"dialogue"|"voiceover"|"narration"}>;music?:{direction:string;intensity:number};effects?:string[];ambience?:string}>;
 candidates:AudioAssetCandidate[];assetAssignments?:Record<string,string>;
}):AudioProductionPlan{
 const cues:AudioCueDraft[]=[];const warnings:string[]=[];
 const add=(cue:AudioCueDraft)=>{const v=validateAudioCue(cue,input.targetDurationMs);if(!v.valid)throw new Error(v.errors.join("; "));cues.push(cue)};
 for(const scene of [...input.scenes].sort((a,b)=>a.order-b.order)){
  let dialogueOffset=0;
  for(let i=0;i<scene.dialogue.length;i++){
   const line=scene.dialogue[i]!;
   const words=line.line.trim().split(/\\s+/).filter(Boolean).length;
   const durationMs=Math.max(800,Math.ceil(words/2.5*1000));
   const id="dlg_"+scene.id+"_"+(i+1);
   const assetId=input.assetAssignments?.[id]??null;
   const asset=assetId?input.candidates.find(a=>a.id===assetId):undefined;
   const reasons=asset?audioAssetReasons(asset):["VOICE_ASSET_NOT_ASSIGNED"];
   const startMs=scene.startMs+dialogueOffset;
   const withinScene=startMs+durationMs<=scene.startMs+scene.durationMs;
   if(!withinScene)reasons.push("ESTIMATED_DIALOGUE_EXCEEDS_SCENE");
   if(!asset)reasons.push("VOICE_GENERATION_OR_RECORDING_REQUIRED");
   if(asset&&asset.durationSeconds!==undefined&&asset.durationSeconds!==null&&asset.durationSeconds*1000+100<durationMs)reasons.push("SOURCE_TOO_SHORT");
   add({id,kind:line.kind==="narration"?"narration":"dialogue",sceneId:scene.id,sceneOrder:scene.order,title:line.speaker||"Narration",text:line.line,speaker:line.speaker,startMs,durationMs,timingConfidence:"estimated",assetId:asset?.id??null,assetState:reasons.length?"needs_review":"ready",readinessReasons:reasons,gainDb:0,fadeInMs:0,fadeOutMs:80,duckingTarget:"none",sourceStartMs:0,sourceDurationMs:asset?.durationSeconds?Math.round(asset.durationSeconds*1000):null,metadata:{estimatedWordsPerMinute:150,source:"approved_script",requiresSyncReview:true}});
   dialogueOffset+=durationMs;
  }
  if(scene.music?.direction){
   const id="mus_"+scene.id;const assetId=input.assetAssignments?.[id]??null;const asset=assetId?input.candidates.find(a=>a.id===assetId):undefined;
   const reasons=asset?audioAssetReasons(asset):["MUSIC_ASSET_NOT_ASSIGNED"];
   if(!asset)reasons.push("MUSIC_SELECTION_REQUIRED");
   add({id,kind:"music",sceneId:scene.id,sceneOrder:scene.order,title:scene.music.direction,startMs:scene.startMs,durationMs:scene.durationMs,timingConfidence:"estimated",assetId:asset?.id??null,assetState:reasons.length?"needs_review":"ready",readinessReasons:reasons,gainDb:-18,fadeInMs:500,fadeOutMs:800,duckingTarget:"dialogue",sourceStartMs:0,sourceDurationMs:asset?.durationSeconds?Math.round(asset.durationSeconds*1000):null,metadata:{intensity:scene.music.intensity,direction:scene.music.direction,requiresHumanAudition:true}});
  }
  if(scene.ambience){
   const id="amb_"+scene.id;const assetId=input.assetAssignments?.[id]??null;const asset=assetId?input.candidates.find(a=>a.id===assetId):undefined;
   const reasons=asset?audioAssetReasons(asset):["AMBIENCE_ASSET_NOT_ASSIGNED"];
   if(!asset)reasons.push("AMBIENCE_ASSET_NOT_ASSIGNED");
   add({id,kind:"ambience",sceneId:scene.id,sceneOrder:scene.order,title:scene.ambience,startMs:scene.startMs,durationMs:scene.durationMs,timingConfidence:"unconfirmed",assetId:asset?.id??null,assetState:"needs_review",readinessReasons:reasons.concat("AMBIENCE_LEVEL_REQUIRES_REVIEW"),gainDb:-30,fadeInMs:300,fadeOutMs:500,sourceStartMs:0,sourceDurationMs:asset?.durationSeconds?Math.round(asset.durationSeconds*1000):null,metadata:{requiresHumanAudition:true}});
  }
  for(let i=0;i<(scene.effects??[]).length;i++){
   const effect=scene.effects![i]!;const id="sfx_"+scene.id+"_"+(i+1);const assetId=input.assetAssignments?.[id]??null;const asset=assetId?input.candidates.find(a=>a.id===assetId):undefined;
   const reasons=asset?audioAssetReasons(asset):["SFX_ASSET_NOT_ASSIGNED"];
   if(!asset)reasons.push("SFX_ASSET_SELECTION_REQUIRED");
   add({id,kind:"sfx",sceneId:scene.id,sceneOrder:scene.order,title:effect,startMs:null,durationMs:null,timingConfidence:"unconfirmed",assetId:asset?.id??null,assetState:"needs_timing",readinessReasons:reasons.concat("SFX_TIMECODE_REQUIRES_EDITOR"),gainDb:-12,fadeInMs:0,fadeOutMs:50,sourceStartMs:0,sourceDurationMs:asset?.durationSeconds?Math.round(asset.durationSeconds*1000):null,metadata:{placement:"manual",requiresHumanPlacement:true}});
  }
 }
 for(const cue of cues)if(cue.assetState!=="ready")warnings.push(...cue.readinessReasons.map(r=>cue.id+":"+r));
 const ready=cues.filter(c=>c.assetState==="ready").length;
 const readinessScore=cues.length?Math.round(ready/cues.length*100):100;
 const readiness=ready===cues.length?"ready":cues.some(c=>c.assetState==="needs_review"||c.assetState==="needs_timing")?"review_required":"incomplete";
 return{title:"Audio Production — "+input.productionCutId,productionCutId:input.productionCutId,scriptPackageId:input.scriptPackageId,targetDurationMs:input.targetDurationMs,readinessScore,readiness,cues,warnings:[...new Set(warnings)],createdAt:new Date().toISOString()};
}
export function evaluateAudioAnalysis(metrics:AudioAnalysisMetrics,thresholds:AudioQaThresholds={}):AudioQaFinding[]{
 const findings:AudioQaFinding[]=[];
 const add=(code:string,severity:"info"|"warning"|"error",message:string,metadata?:Record<string,unknown>)=>findings.push({code,severity,message,confidence:1,...(metadata?{metadata}:{})});
 if(!metrics.analysisAvailable){add("AUDIO_ANALYSIS_UNAVAILABLE","warning","Audio analysis could not be completed by the configured tools.");return findings}
 if(metrics.clippingSamples!==null&&(metrics.clippingSamples>(thresholds.maxClippingSamples??0)))add("AUDIO_CLIPPING","error","Clipped audio samples were detected.",{clippingSamples:metrics.clippingSamples});
 if(metrics.truePeakDbtp!==null&&thresholds.maxTruePeakDbtp!==undefined&&metrics.truePeakDbtp>thresholds.maxTruePeakDbtp)add("TRUE_PEAK_ABOVE_TARGET","warning","True peak exceeds the configured ceiling.",{truePeakDbtp:metrics.truePeakDbtp,ceiling:thresholds.maxTruePeakDbtp});
 if(metrics.rmsDbfs!==null&&thresholds.minRmsDbfs!==undefined&&metrics.rmsDbfs<thresholds.minRmsDbfs)add("AUDIO_LEVEL_BELOW_TARGET","warning","RMS level is below the configured threshold.",{rmsDbfs:metrics.rmsDbfs,minimum:thresholds.minRmsDbfs});
 const maxSilence=thresholds.maxSilenceSeconds??5;
 for(const silence of metrics.silenceIntervals)if(silence.duration>=maxSilence)add("LONG_AUDIO_SILENCE","warning","Silence exceeds the configured duration.",{...silence,threshold:maxSilence});
 if(metrics.syncOffsetMs===null)add("SYNC_NOT_MEASURED","info","A/V or lip-sync offset was not measured; no automatic sync correction is proposed.");
 else if(Math.abs(metrics.syncOffsetMs)>80)add("SYNC_OFFSET","warning","Measured audio/video sync offset exceeds 80 ms.",{offsetMs:metrics.syncOffsetMs});
 return findings;
}
export interface DuckingConfig{enabled:boolean;thresholdDb:number;ratio:number;attackMs:number;releaseMs:number;reductionDb:number}
export function validateDuckingConfig(c:DuckingConfig){
 const errors:string[]=[];
 if(c.thresholdDb>0||c.thresholdDb< -60)errors.push("Ducking threshold must be between -60 and 0 dB");
 if(c.ratio<1||c.ratio>20)errors.push("Ducking ratio must be between 1:1 and 20:1");
 if(c.attackMs<1||c.attackMs>2000||c.releaseMs<10||c.releaseMs>10000)errors.push("Invalid ducking attack/release time");
 if(c.reductionDb<0||c.reductionDb>24)errors.push("Ducking reduction must be between 0 and 24 dB");
 return{valid:errors.length===0,errors};
}
