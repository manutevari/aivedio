import path from "node:path";
import {spawn} from "node:child_process";
import type {RenderManifest} from "@aivedio/core";
import {validateRenderManifest} from "@aivedio/core";
export interface CompiledRender{args:string[];expectedDurationMs:number;subtitleSidecar?:string}
const sec=(n:number)=>(n/1000).toFixed(3);
export function resolveMediaPath(key:string,root=process.env.MEDIA_ROOT??"./media"){
 const base=path.resolve(root),target=path.resolve(base,key);
 if(!target.startsWith(base+path.sep))throw new Error("Media path escapes MEDIA_ROOT");
 return target;
}
export function compileRender(manifest:RenderManifest,paths:string[],outputPath:string,sidecarPath?:string):CompiledRender{
 const validation=validateRenderManifest(manifest);if(!validation.valid)throw new Error(validation.errors.join("; "));
 const args:string[]=[];manifest.videoClips.forEach((c,i)=>{if(c.mimeType.startsWith("image/"))args.push("-loop","1","-t",sec(c.timelineDurationMs),"-i",paths[i]!);else args.push("-i",paths[i]!)});
 manifest.audioClips.forEach((c,i)=>{args.push("-i",paths[manifest.videoClips.length+i]!)});
 const filters:string[]=[];
 const duration=manifest.durationMs/1000;
 filters.push(`color=c=black:s=${manifest.profile.width}x${manifest.profile.height}:r=${manifest.profile.fps}:d=${sec(manifest.durationMs)},format=yuv420p[base]`);
 let current="base";
 manifest.videoClips.forEach((c,i)=>{
  const label="v"+i;
  const rate=c.playbackRate;
  filters.push(`[${i}:v]trim=start=${sec(c.sourceStartMs)}:duration=${sec(c.sourceDurationMs)},setpts=(PTS-STARTPTS)/${rate},scale=${manifest.profile.width}:${manifest.profile.height}:force_original_aspect_ratio=decrease,pad=${manifest.profile.width}:${manifest.profile.height}:(ow-iw)/2:(oh-ih)/2,fps=${manifest.profile.fps},setsar=1,format=rgba,colorchannelmixer=aa=${c.opacity}[${label}]`);
  const out="ov"+i;filters.push(`[${current}][${label}]overlay=eof_action=pass:shortest=0:enable='between(t,${sec(c.timelineStartMs)},${sec(c.timelineStartMs+c.timelineDurationMs)})'[${out}]`);current=out;
 });
 let videoOut=current;
 if(manifest.subtitleMode==="burn_in"&&manifest.subtitles.length&&sidecarPath){const sub="subbed";filters.push(`[${current}]subtitles='${sidecarPath.replace(/\\/g,"/").replace(/:/g,"\\:")}'[${sub}]`);videoOut=sub}
 const audLabels:string[]=[];
 manifest.audioClips.forEach((c,i)=>{
  if(c.muted)return;const idx=manifest.videoClips.length+i,label="a"+i;
  const rate=c.playbackRate;
  const gain=Math.pow(10,c.trackGainDb/20)*c.volume;
  const delay=Math.round(c.timelineStartMs);
  let filter=`[${idx}:a]atrim=start=${sec(c.sourceStartMs)}:duration=${sec(c.sourceDurationMs)},asetpts=PTS-STARTPTS,atempo=${rate},volume=${gain.toFixed(6)},adelay=${delay}|${delay},aformat=sample_rates=${manifest.profile.audioSampleRate}:channel_layouts=stereo`;
  // Ducking is deliberately only compiled if an active dialogue signal exists.
  const duck=c.ducking?.enabled&&manifest.audioClips.some(x=>x.trackKind==="audio"&&!x.muted);
  // Ducking config is retained in the manifest but not executed until a dialogue sidechain is compiled safely.
  filters.push(filter+`[${label}]`);audLabels.push(`[${label}]`);
 });
 if(audLabels.length)filters.push(audLabels.join("")+`amix=inputs=${audLabels.length}:duration=longest:normalize=0,alimiter=limit=0.95[aout]`);
 args.push("-filter_complex",filters.join(";"),"-map",`[${videoOut}]`);
 if(audLabels.length)args.push("-map","[aout]");else args.push("-an");
 args.push("-t",sec(manifest.durationMs),"-c:v",manifest.profile.videoCodec==="h265"?"libx265":manifest.profile.videoCodec==="vp9"?"libvpx-vp9":"libx264","-crf",manifest.profile.quality==="draft"?"28":manifest.profile.quality==="high"?"18":"23","-pix_fmt","yuv420p");
 if(audLabels.length)args.push("-c:a",manifest.profile.audioCodec==="opus"?"libopus":manifest.profile.audioCodec==="pcm"?"pcm_s16le":"aac","-ar",String(manifest.profile.audioSampleRate));
 if(manifest.profile.container!=="webm")args.push("-movflags","+faststart");
 args.push("-progress","pipe:1","-nostats","-y","-f",manifest.profile.container,outputPath);
 return{args,expectedDurationMs:manifest.durationMs,subtitleSidecar:manifest.subtitleMode==="sidecar"?sidecarPath:undefined};
}
export function runFfmpeg(args:string[],progress?:(line:string)=>void,signal?:AbortSignal){
 return new Promise<void>((resolve,reject)=>{const child=spawn("ffmpeg",["-hide_banner","-nostdin",...args],{shell:false,stdio:["ignore","pipe","pipe"],signal});let stderr="";child.stdout.on("data",d=>{const s=String(d);for(const line of s.split(/\r?\n/) )progress?.(line)});child.stderr.on("data",d=>{stderr=(stderr+String(d)).slice(-8000)});child.on("error",reject);child.on("close",code=>code===0?resolve():reject(new Error("FFmpeg exited "+code+": "+stderr)))});
}
export async function probeOutput(output:string){
 return new Promise<any>((resolve,reject)=>{const child=spawn("ffprobe",["-v","error","-show_format","-show_streams","-of","json",output],{shell:false});let data="",err="";child.stdout.on("data",d=>data+=String(d));child.stderr.on("data",d=>err+=String(d));child.on("error",reject);child.on("close",code=>code===0?resolve(JSON.parse(data)):reject(new Error("ffprobe failed: "+err)))});
}
