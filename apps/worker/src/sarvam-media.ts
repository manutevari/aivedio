import {spawn} from "node:child_process";
import type {MediaTaskContract,MediaTaskHandler} from "@aivedio/core";
type SarvamOptions={apiKey?:string;baseUrl?:string;timeoutMs?:number};
const API="https://api.sarvam.ai";
function requireKey(options:SarvamOptions){const key=options.apiKey??process.env.SARVAM_API_KEY;if(!key)throw new Error("SARVAM_API_KEY is not configured on the worker");return key}
async function requestJson(path:string,body:Record<string,unknown>,options:SarvamOptions={}){
 const response=await fetch((options.baseUrl??API)+path,{method:"POST",headers:{"api-subscription-key":requireKey(options),"content-type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(options.timeoutMs??60000)});
 if(!response.ok){const detail=(await response.text()).slice(0,1000);throw new Error("Sarvam "+response.status+" "+path+": "+detail)}
 return response.json() as Promise<Record<string,unknown>>;
}
export async function sarvamTranslate(input:{text:string;sourceLanguageCode:string;targetLanguageCode:string;model?:string;mode?:"formal"|"colloquial"|"code-mixed"},options:SarvamOptions={}){
 if(!input.text.trim()||input.text.length>2000)throw new Error("Translation text must contain 1–2000 characters");
 return requestJson("/translate",{input:input.text,source_language_code:input.sourceLanguageCode,target_language_code:input.targetLanguageCode,model:input.model??"mayura:v1",mode:input.mode??"formal"},options);
}
export async function sarvamTransliterate(input:{text:string;sourceLanguageCode:string;targetLanguageCode:string},options:SarvamOptions={}){
 if(!input.text.trim()||input.text.length>2000)throw new Error("Transliteration text must contain 1–2000 characters");
 return requestJson("/transliterate",{input:input.text,source_language_code:input.sourceLanguageCode,target_language_code:input.targetLanguageCode},options);
}
export async function sarvamSynthesize(input:{text:string;languageCode:string;speaker:string;model?:string;pace?:number;pitch?:number;loudness?:number;temperature?:number},options:SarvamOptions={}){
 if(!input.text.trim()||input.text.length>2500)throw new Error("TTS text must contain 1–2500 characters per request");
 const body=await requestJson("/text-to-speech",{text:input.text,language_code:input.languageCode,speaker:input.speaker,model:input.model??"bulbul:v4-flash",pace:input.pace??1.0,pitch:input.pitch??0,loudness:input.loudness??1.0,temperature:input.temperature??0.6},options);
 const audios=body.audios;if(!Array.isArray(audios)||typeof audios[0]!=="string")throw new Error("Sarvam TTS response did not contain base64 audio");
 return {audio:Buffer.from(audios[0],"base64"),requestId:String(body.request_id??""),model:input.model??"bulbul:v4-flash"};
}
/** Apply non-destructive FFmpeg denoising into a separate output file; never overwrite the source. */
export async function denoiseAudio(inputPath:string,outputPath:string,options:{noiseFloorDb?:number;highpassHz?:number;lowpassHz?:number}={}):Promise<void>{
 if(inputPath===outputPath)throw new Error("Noise cancellation must write to a new output path");
 const nf=Math.max(-80,Math.min(-10,options.noiseFloorDb??-25));
 const hp=Math.max(20,Math.min(1000,options.highpassHz??80));
 const lp=Math.max(2000,Math.min(20000,options.lowpassHz??12000));
 await new Promise<void>((resolve,reject)=>{const p=spawn("ffmpeg",["-nostdin","-y","-i",inputPath,"-af",`highpass=f=${hp},lowpass=f=${lp},afftdn=nf=${nf}:tn=1:tr=1`,"-c:a","libmp3lame","-q:a","2",outputPath],{stdio:["ignore","ignore","pipe"]});let err="";p.stderr.on("data",d=>{err=(err+String(d)).slice(-4000)});p.on("error",reject);p.on("close",code=>code===0?resolve():reject(new Error("FFmpeg denoise failed ("+code+"): "+err)))});
}
export function createSarvamMediaHandler():MediaTaskHandler {
 return {async execute(task:MediaTaskContract,signal:AbortSignal){
  if(signal.aborted)throw new Error("Task aborted");
  const input=task.input as Record<string,any>;
  switch(task.kind){
   case "text.translate":case "text.localize":return sarvamTranslate({text:String(input.text??""),sourceLanguageCode:String(input.sourceLanguageCode??"auto"),targetLanguageCode:String(input.targetLanguageCode??"hi-IN"),mode:input.mode==="colloquial"||input.mode==="code-mixed"?input.mode:"formal"});
   case "text.transliterate":return sarvamTransliterate({text:String(input.text??""),sourceLanguageCode:String(input.sourceLanguageCode??"hi-IN"),targetLanguageCode:String(input.targetLanguageCode??"en-IN")});
   case "speech.generate":{const result=await sarvamSynthesize({text:String(input.text??""),languageCode:String(input.languageCode??"hi-IN"),speaker:String(input.speaker??"shubh_hi_female"),model:typeof input.model==="string"?input.model:undefined,pace:typeof input.pace==="number"?input.pace:1});return {audioBase64:result.audio.toString("base64"),requestId:result.requestId,model:result.model,mimeType:"audio/mpeg"}}
   case "audio.denoise":await denoiseAudio(String(input.inputPath??""),String(input.outputPath??""));return {outputPath:String(input.outputPath)};
   default:throw new Error("Unsupported Sarvam worker task: "+task.kind);
  }
 }};
}
