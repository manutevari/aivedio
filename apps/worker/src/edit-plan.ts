import {RenderProfile,TransitionSpec,validateTransition} from "@aivedio/core";
export interface VideoSegment{inputIndex:number;sourceStartMs:number;durationMs:number;transitionIn?:TransitionSpec}
export interface AudioSegment{inputIndex:number;sourceStartMs:number;durationMs:number;timelineStartMs:number;volume:number;gainDb?:number;muted?:boolean}
const sec=(n:number)=>(n/1000).toFixed(3);
const transitionMap:Record<string,string>={fade:"fade",dissolve:"fade",wipeleft:"wipeleft",wiperight:"wiperight",slideleft:"slideleft",slideright:"slideright"};
export function buildCompositionFilter(video:VideoSegment[],audio:AudioSegment[],profile:RenderProfile){
 if(!video.length)throw new Error("No video segments");
 const filters:string[]=[];video.forEach((v,i)=>{if(v.sourceStartMs<0||v.durationMs<=0)throw new Error("Invalid video timing");filters.push(`[${v.inputIndex}:v]trim=start=${sec(v.sourceStartMs)}:duration=${sec(v.durationMs)},setpts=PTS-STARTPTS,scale=${profile.width}:${profile.height}:force_original_aspect_ratio=decrease,pad=${profile.width}:${profile.height}:(ow-iw)/2:(oh-ih)/2,fps=${profile.fps},setsar=1,format=yuv420p[v${i}]`)});
 let current="v0",acc=video[0]!.durationMs;
 for(let i=1;i<video.length;i++){const v=video[i]!,tr=v.transitionIn??{type:"cut" as const,durationMs:0};const check=validateTransition(tr);if(!check.valid)throw new Error(check.errors.join("; "));const next="v"+i,output="vx"+i;if(tr.type==="cut")filters.push(`[${current}][${next}]concat=n=2:v=1:a=0[${output}]`);else{const name=transitionMap[tr.type];if(!name)throw new Error("Unsupported transition");if(tr.durationMs>Math.min(acc,v.durationMs))throw new Error("Transition exceeds adjacent clip");filters.push(`[${current}][${next}]xfade=transition=${name}:duration=${sec(tr.durationMs)}:offset=${sec(acc-tr.durationMs)}[${output}]`)}current=output;acc+=v.durationMs-tr.durationMs}
 const audioLabels:string[]=[];audio.forEach((a,i)=>{if(a.muted)return;if(a.sourceStartMs<0||a.durationMs<=0||a.timelineStartMs<0||a.volume<0||a.volume>4)throw new Error("Invalid audio segment");const label="a"+i,gain=Math.pow(10,(a.gainDb??0)/20)*a.volume,delay=Math.round(a.timelineStartMs);filters.push(`[${a.inputIndex}:a]atrim=start=${sec(a.sourceStartMs)}:duration=${sec(a.durationMs)},asetpts=PTS-STARTPTS,volume=${gain.toFixed(5)},adelay=${delay}|${delay},aformat=sample_rates=${profile.audioSampleRate}:channel_layouts=stereo[${label}]`);audioLabels.push(`[${label}]`)});
 if(audioLabels.length)filters.push(audioLabels.join("")+`amix=inputs=${audioLabels.length}:duration=longest:normalize=0,alimiter=limit=0.95[aout]`);
 return{filterComplex:filters.join(";"),videoOutput:current,audioOutput:audioLabels.length?"aout":null,durationMs:acc}
}
export function buildCompositionArgs(inputs:string[],video:VideoSegment[],audio:AudioSegment[],profile:RenderProfile,outputPath:string){
 const composed=buildCompositionFilter(video,audio,profile);const args:string[]=[];for(const path of inputs)args.push("-i",path);
 args.push("-filter_complex",composed.filterComplex,"-map",`[${composed.videoOutput}]`);if(composed.audioOutput)args.push("-map",`[${composed.audioOutput}]`);else args.push("-an");
 args.push("-t",sec(composed.durationMs),"-c:v",profile.videoCodec==="h265"?"libx265":profile.videoCodec==="vp9"?"libvpx-vp9":"libx264","-crf",profile.quality==="draft"?"28":profile.quality==="high"?"18":"23");
 if(composed.audioOutput)args.push("-c:a",profile.audioCodec==="opus"?"libopus":profile.audioCodec==="pcm"?"pcm_s16le":"aac","-ar",String(profile.audioSampleRate));
 if(profile.container!=="webm")args.push("-movflags","+faststart");args.push("-y",outputPath);return args
}
