import pg from "pg";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import {resolveMediaPath,compileRender,runFfmpeg,probeOutput} from "./render-plan.js";
import type {RenderManifest} from "@aivedio/core";
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSLMODE==="require"?{rejectUnauthorized:false}:undefined});
const workerId=process.env.RENDER_WORKER_ID??"render-"+process.pid;let stopped=false;
process.on("SIGINT",()=>stopped=true);process.on("SIGTERM",()=>stopped=true);
const srtTime=(ms:number)=>{const n=Math.max(0,Math.round(ms));const h=Math.floor(n/3600000),m=Math.floor(n%3600000/60000),s=Math.floor(n%60000/1000),x=n%1000;return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(x).padStart(3,"0")}`};
function srt(manifest:RenderManifest){return manifest.subtitles.map((c,i)=>`${i+1}\n${srtTime(c.startMs)} --> ${srtTime(c.endMs)}\n${c.text.replace(/\r?\n/g," ")}\n`).join("\n")}
async function claim(){
 const c=await pool.connect();try{await c.query("BEGIN");
 const r=await c.query("SELECT * FROM render_jobs WHERE (status='queued' AND available_at<=now()) OR (status IN ('validating','rendering','uploading') AND lease_expires_at<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1");
 if(!r.rowCount){await c.query("COMMIT");return null}const j=r.rows[0];
 const u=await c.query("UPDATE render_jobs SET status='validating',attempt=attempt+1,lease_owner=$2,lease_expires_at=now()+interval '20 minutes',stage='validating',error=NULL,updated_at=now() WHERE id=$1 RETURNING *",[j.id,workerId]);await c.query("COMMIT");return u.rows[0];
 }catch(e){await c.query("ROLLBACK");throw e}finally{c.release()}}
async function checkpoint(id:string,stage:string,progress:number,data:Record<string,unknown>={}){
 await pool.query("UPDATE render_jobs SET stage=$2,progress=$3,checkpoint=checkpoint||$4::jsonb,lease_expires_at=now()+interval '20 minutes',updated_at=now() WHERE id=$1 AND lease_owner=$5",[id,stage,progress,JSON.stringify({stage,at:new Date().toISOString(),...data}),workerId]);
}
async function run(j:any){
 const root=path.resolve(process.env.MEDIA_ROOT??"./media"),outRoot=path.resolve(process.env.RENDER_OUTPUT_ROOT??"./renders");
 const manifest=j.manifest as RenderManifest;if(!manifest)throw new Error("Render job has no immutable manifest snapshot");
 const v=(await import("@aivedio/core")).validateRenderManifest(manifest);if(!v.valid)throw new Error(v.errors.join("; "));
 await fs.mkdir(outRoot,{recursive:true});
 const final=path.join(outRoot,j.id+"."+manifest.profile.container),temp=final+".partial";
 const subPath=path.join(outRoot,j.id+".srt");
 const clips=[...manifest.videoClips,...manifest.audioClips];const paths=clips.map(c=>resolveMediaPath(c.storageKey,root));
 for(const p of paths)await fs.access(p);
 if(manifest.subtitleMode!=="none"&&manifest.subtitles.length)await fs.writeFile(subPath,srt(manifest),"utf8");
 const compiled=compileRender(manifest,paths,temp,manifest.subtitleMode==="burn_in"?subPath:undefined);
 await checkpoint(j.id,"ffmpeg",0.03,{manifestHash:crypto.createHash("sha256").update(JSON.stringify(manifest)).digest("hex")});
 await runFfmpeg(compiled.args,line=>{const m=line.match(/out_time_ms=(\d+)/);if(m){const progress=Math.min(.9,0.05+Number(m[1])/1000000/Math.max(.001,manifest.durationMs/1000)*.85);void checkpoint(j.id,"rendering",progress)}});
 const probe=await probeOutput(temp);const format=probe.format??{};const streams=probe.streams??[];const video=streams.find((s:any)=>s.codec_type==="video"),audio=streams.find((s:any)=>s.codec_type==="audio");
 const actualDuration=Number(format.duration??video?.duration??0)*1000;
 const findings:any[]=[];
 if(!video)findings.push({code:"VIDEO_STREAM_MISSING",severity:"error"});
 if(actualDuration<=0)findings.push({code:"DURATION_INVALID",severity:"error"});
 if(actualDuration&&Math.abs(actualDuration-manifest.durationMs)>Math.max(1500,manifest.durationMs*.05))findings.push({code:"DURATION_MISMATCH",severity:"warning",expectedMs:manifest.durationMs,actualMs:actualDuration});
 if(video&&(video.width!==manifest.profile.width||video.height!==manifest.profile.height))findings.push({code:"RESOLUTION_MISMATCH",severity:"warning",expected:[manifest.profile.width,manifest.profile.height],actual:[video.width,video.height]});
 if(manifest.expectedAudio&&!audio)findings.push({code:"AUDIO_STREAM_MISSING",severity:"error"});
 const qaStatus=findings.some(x=>x.severity==="error")?"fail":findings.length?"warning":"pass";
 await checkpoint(j.id,"output_qa",0.95,{qaStatus,findings,probeSummary:{duration:actualDuration,width:video?.width,height:video?.height,videoCodec:video?.codec_name,audioCodec:audio?.codec_name}});
 if(qaStatus==="fail"){await fs.rm(temp,{force:true});throw new Error("Post-render QA failed: "+findings.map(x=>x.code).join(", "))}
 await fs.rename(temp,final);
 const data=await fs.readFile(final);const checksum=crypto.createHash("sha256").update(data).digest("hex");const stat=await fs.stat(final);
 const sidecar=manifest.subtitleMode==="sidecar"&&manifest.subtitles.length?await fs.stat(subPath):null;
 await pool.query("UPDATE render_jobs SET status='awaiting_review',stage='rendered',progress=1,output_storage_key=$2,output_checksum=$3,output_size_bytes=$4,qa_status=$5,qa_report=$6,review_status='pending',lease_owner=NULL,lease_expires_at=NULL,completed_at=now(),updated_at=now() WHERE id=$1 AND lease_owner=$7",[j.id,path.relative(outRoot,final),checksum,stat.size,qaStatus,{findings,probeSummary:{duration:actualDuration,width:video?.width,height:video?.height,videoCodec:video?.codec_name,audioCodec:audio?.codec_name},sidecar:sidecar?path.relative(outRoot,subPath):null},workerId]);
 console.log("Render ready for review",j.id,stat.size,qaStatus);
}
async function fail(j:any,e:unknown){
 const message=e instanceof Error?e.message:String(e);const retry=Number(j.attempt)<Number(j.max_attempts??3);
 await pool.query("UPDATE render_jobs SET status=$2,stage='failed',error=$3,lease_owner=NULL,lease_expires_at=NULL,available_at=now()+($4||' seconds')::interval,updated_at=now() WHERE id=$1 AND lease_owner=$5",[j.id,retry?"queued":"failed",message,String(Math.min(600,20*2**Math.max(0,Number(j.attempt)-1))),workerId]);
}
async function main(){if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required");try{while(!stopped){try{const j=await claim();if(j){try{await run(j)}catch(e){await fail(j,e);console.error("Render failed",j.id,e)}continue}}catch(e){console.error("Render worker polling error",e)}await new Promise(r=>setTimeout(r,Number(process.env.RENDER_POLL_MS??4000)))}}finally{await pool.end()}}
main().catch(e=>{console.error(e);process.exitCode=1});
