import type {RenderProfile} from "./timeline.js";
import {validateRenderProfile} from "./timeline.js";
import {validateSubtitleCue,SubtitleCue} from "./editing.js";

export type RenderTransition="cut"|"fade"|"dissolve";
export interface RenderVideoInput{
 assetId:string;storageKey:string;mimeType:string;title:string;
 sourceStartMs:number;timelineStartMs:number;timelineDurationMs:number;
 opacity:number;playbackRate:number;zIndex:number;trackOrder:number;
 transitionIn?:RenderTransition;transitionDurationMs?:number;
}
export interface RenderDucking{
 enabled:boolean;thresholdDb:number;ratio:number;attackMs:number;releaseMs:number;reductionDb?:number;
}
export interface RenderAudioInput{
 assetId:string;storageKey:string;mimeType:string;title:string;
 sourceStartMs:number;timelineStartMs:number;timelineDurationMs:number;sourceDurationMs:number;
 playbackRate:number;volume:number;trackGainDb:number;trackKind:"audio"|"music"|"sfx";
 trackOrder:number;muted:boolean;ducking?:RenderDucking;
}
export interface RenderManifest{
 schemaVersion:1;projectId:string;profile:RenderProfile;durationMs:number;
 videoClips:RenderVideoInput[];audioClips:RenderAudioInput[];
 subtitles:SubtitleCue[];subtitleMode:"burn_in"|"sidecar"|"none";
 expectedAudio:boolean;createdAt:string;
}
function safeStorageKey(key:string){
 if(!key||key.length>1024||key.includes("\\")||key.startsWith("/")||/^[a-z]+:\/\//i.test(key))return false;
 return key.split("/").every(part=>part!==""&&part!=="."&&part!=="..");
}
export function validateRenderManifest(m:RenderManifest){
 const errors:string[]=[];
 if(m.schemaVersion!==1)errors.push("Unsupported render manifest version");
 if(!m.projectId)errors.push("Project id is required");
 const p=validateRenderProfile(m.profile);errors.push(...p.errors);
 if(!Number.isFinite(m.durationMs)||m.durationMs<=0||m.durationMs>12*60*60*1000)errors.push("Render duration must be between 1ms and 12 hours");
 if(!Array.isArray(m.videoClips)||!m.videoClips.length)errors.push("At least one visual clip is required");
 if((m.videoClips?.length??0)>1000||(m.audioClips?.length??0)>2000)errors.push("Render exceeds the configured clip count limit");
 for(const [i,c] of (m.videoClips??[]).entries()){
  if(!safeStorageKey(c.storageKey))errors.push("Video clip "+i+" has an unsafe storage key");
  if(!c.mimeType.startsWith("video/")&&!c.mimeType.startsWith("image/"))errors.push("Video clip "+i+" has unsupported media type");
  if(!Number.isFinite(c.sourceStartMs)||c.sourceStartMs<0||!Number.isFinite(c.timelineStartMs)||c.timelineStartMs<0||!Number.isFinite(c.timelineDurationMs)||c.timelineDurationMs<=0)errors.push("Video clip "+i+" has invalid timing");
  if(c.timelineStartMs+c.timelineDurationMs>m.durationMs+100)errors.push("Video clip "+i+" exceeds composition duration");
  if(!Number.isFinite(c.opacity)||c.opacity<0||c.opacity>1)errors.push("Video clip "+i+" opacity must be 0–1");
  if(!Number.isFinite(c.playbackRate)||c.playbackRate<0.25||c.playbackRate>4)errors.push("Video clip "+i+" playback rate must be 0.25–4");
  if(c.transitionIn&&!["cut","fade","dissolve"].includes(c.transitionIn))errors.push("Video clip "+i+" has an unsupported transition");
  if(c.transitionDurationMs!==undefined&&(!Number.isFinite(c.transitionDurationMs)||c.transitionDurationMs<0||c.transitionDurationMs>5000))errors.push("Video clip "+i+" has invalid transition duration");
 }
 for(const [i,c] of (m.audioClips??[]).entries()){
  if(!safeStorageKey(c.storageKey))errors.push("Audio clip "+i+" has an unsafe storage key");
  if(!c.mimeType.startsWith("audio/")&&!c.mimeType.startsWith("video/"))errors.push("Audio clip "+i+" has unsupported media type");
  if(!Number.isFinite(c.sourceStartMs)||c.sourceStartMs<0||!Number.isFinite(c.timelineStartMs)||c.timelineStartMs<0||!Number.isFinite(c.timelineDurationMs)||c.timelineDurationMs<=0||!Number.isFinite(c.sourceDurationMs)||c.sourceDurationMs<=0)errors.push("Audio clip "+i+" has invalid timing");
  if(c.timelineStartMs+c.timelineDurationMs>m.durationMs+100)errors.push("Audio clip "+i+" exceeds composition duration");
  if(c.playbackRate<0.5||c.playbackRate>2)errors.push("Audio clip "+i+" playback rate must be 0.5–2");
  if(c.volume<0||c.volume>4||c.trackGainDb< -60||c.trackGainDb>24)errors.push("Audio clip "+i+" has invalid gain");
  if(c.ducking?.enabled&&(c.ducking.thresholdDb< -60||c.ducking.thresholdDb>0||c.ducking.ratio<1||c.ducking.ratio>20||c.ducking.attackMs<1||c.ducking.releaseMs<10))errors.push("Audio clip "+i+" has invalid ducking settings");
 }
 for(const cue of m.subtitles??[]){const v=validateSubtitleCue(cue);errors.push(...v.errors.map(e=>cue.id+": "+e));if(cue.endMs>m.durationMs+100)errors.push("Subtitle "+cue.id+" exceeds composition duration")}
 if(!["burn_in","sidecar","none"].includes(m.subtitleMode))errors.push("Invalid subtitle mode");
 if(m.expectedAudio!==(m.audioClips.some(c=>!c.muted)))errors.push("Expected audio flag does not match active audio clips");
 return{valid:errors.length===0,errors};
}
