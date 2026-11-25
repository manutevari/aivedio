import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
import pg from "pg";

const {Pool}=pg;
const apiRoot=fileURLToPath(new URL("../",import.meta.url));
const port=Number(process.env.AIVEDIO_E2E_PORT??3419);
const baseUrl=`http://127.0.0.1:${port}`;
let token="";
const bootstrapKey=process.env.AIVEDIO_BOOTSTRAP_ADMIN_KEY;
const databaseUrl=process.env.DATABASE_URL;
if(!bootstrapKey)throw new Error("AIVEDIO_BOOTSTRAP_ADMIN_KEY is required for the API smoke test");
if(!databaseUrl)throw new Error("DATABASE_URL is required for the API smoke test");

const db=new Pool({connectionString:databaseUrl,max:4});
const api=spawn(process.execPath,["--import","tsx","src/server.ts"],{
 cwd:apiRoot,
 env:{...process.env,PORT:String(port),NODE_ENV:"test",AIVEDIO_API_TOKEN:token},
 stdio:["ignore","pipe","pipe"]
});
let serverOutput="";
api.stdout.on("data",chunk=>{serverOutput=(serverOutput+chunk.toString()).slice(-6000)});
api.stderr.on("data",chunk=>{serverOutput=(serverOutput+chunk.toString()).slice(-6000)});

async function request(method:string,path:string,body?:unknown,expectedStatus=200){
 const response=await fetch(baseUrl+path,{
  method,
  headers:{...(token?{"Authorization":"Bearer "+token}:{}),...(body===undefined?{}:{"Content-Type":"application/json"})},
  ...(body===undefined?{}:{body:JSON.stringify(body)})
 });
 const raw=await response.text();
 let data:unknown=raw;
 try{data=raw?JSON.parse(raw):null}catch{}
 assert.equal(response.status,expectedStatus,`${method} ${path} expected HTTP ${expectedStatus}, received ${response.status}: ${raw.slice(0,1200)}`);
 return data as any;
}
async function waitForApi(){
 for(let attempt=0;attempt<50;attempt++){
  if(api.exitCode!==null)throw new Error("API process exited before becoming ready.\n"+serverOutput);
  try{
   const response=await fetch(baseUrl+"/ready");
   if(response.status===200)return;
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,300));
 }
 throw new Error("API did not become ready.\n"+serverOutput);
}

try{
 await waitForApi();
 const adminPassword="CI-"+"Admin-"+"Password-123!";
 const bootstrap=await request("POST","/v1/auth/bootstrap",{bootstrapKey,email:"admin@ci.aivedio.test",password:adminPassword,displayName:"CI Admin"},201);
 token=bootstrap.token;
 assert.ok(token,"Bootstrap must return a session token");
 await request("GET","/v1/auth/me",undefined,200);
 const loginSession=await request("POST","/v1/auth/login",{email:"admin@ci.aivedio.test",password:adminPassword},200);
 assert.ok(loginSession.token,"Login must return a session");
 const loginMe=await fetch(baseUrl+"/v1/auth/me",{headers:{Authorization:"Bearer "+loginSession.token}});
 assert.equal(loginMe.status,200);
 const logout=await fetch(baseUrl+"/v1/auth/logout",{method:"POST",headers:{Authorization:"Bearer "+loginSession.token}});
 assert.equal(logout.status,204);
 const revoked=await fetch(baseUrl+"/v1/auth/me",{headers:{Authorization:"Bearer "+loginSession.token}});
 assert.equal(revoked.status,401,"Revoked sessions must stop authenticating");

 await request("GET","/health",undefined,200);
 await request("GET","/ready",undefined,200);
 const unauth=await fetch(baseUrl+"/v1/projects");
 assert.equal(unauth.status,401,"API must reject unauthenticated requests");
 const badLogin=await fetch(baseUrl+"/v1/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"admin@ci.aivedio.test",password:"wrong-password"})});
 assert.equal(badLogin.status,401,"Invalid credentials must be rejected");
 const forgotExisting=await fetch(baseUrl+"/v1/auth/forgot-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"admin@ci.aivedio.test"})});
 const forgotUnknown=await fetch(baseUrl+"/v1/auth/forgot-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"unknown@ci.aivedio.test"})});
 assert.equal(forgotExisting.status,200,"Password recovery should respond generically");
 assert.equal(forgotUnknown.status,200,"Unknown-account recovery should not disclose account existence");
 assert.deepEqual(await forgotExisting.json(),await forgotUnknown.json(),"Password recovery response must be generic");
 const badReset=await fetch(baseUrl+"/v1/auth/reset-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:"invalid-reset-token",password:"New-CI-Password-123!"})});
 assert.equal(badReset.status,400,"Invalid reset tokens must not reset passwords");

 for(let attempt=0;attempt<6;attempt++){
  const response=await fetch(baseUrl+"/v1/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"admin@ci.aivedio.test",password:"incorrect-password"})});
  assert.equal(response.status,401,"Invalid login attempt must be rejected");
 }
 const limited=await fetch(baseUrl+"/v1/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"admin@ci.aivedio.test",password:"incorrect-password"})});
 assert.equal(limited.status,429,"Authentication abuse rate limit must activate");

 const project=await request("POST","/v1/projects",{
  title:"AIVEDIO CI workflow fixture",
  mode:"flow",
  creativeBrief:"A short, original public-service advertisement showing a community taking practical steps to conserve water."
 },201);
 assert.ok(project.id,"Project creation must return an id");
 const mediaTask=await request("POST",`/v1/projects/${project.id}/media-tasks`,{kind:"text.translate",mode:"async",input:{text:"Hello",sourceLanguageCode:"en-IN",targetLanguageCode:"hi-IN"}},202);
 assert.ok(mediaTask.id,"Media task enqueue must return an id");
 const cancelledMediaTask=await request("POST",`/v1/projects/${project.id}/media-tasks/${mediaTask.id}/cancel`,{},200);
 assert.equal(cancelledMediaTask.status,"cancelled","Queued media task cancellation must persist");
 const cancelledMediaTaskRead=await request("GET",`/v1/projects/${project.id}/media-tasks/${mediaTask.id}`,undefined,200);
 assert.equal(cancelledMediaTaskRead.status,"cancelled","Cancelled media task state must be readable by project members");
 const ownerMembers=await request("GET",`/v1/projects/${project.id}/members`,undefined,200);
 assert.equal(ownerMembers.length,1,"New project must automatically assign owner membership");

 const reviewerPassword="CI-"+"Reviewer-"+"Password-123!";
 const second=await request("POST","/v1/auth/register",{email:"reviewer@ci.aivedio.test",password:reviewerPassword,displayName:"CI Reviewer"},201);
 assert.ok(second.token);
 const outsiderList=await fetch(baseUrl+"/v1/projects",{headers:{Authorization:"Bearer "+second.token}});
 assert.equal(outsiderList.status,200);
 const outsiderProjects=await outsiderList.json();
 assert.equal(outsiderProjects.some((p:any)=>p.id===project.id),false,"Project must not appear in another user's project list");
 const outsiderGet=await fetch(baseUrl+`/v1/projects/${project.id}`,{headers:{Authorization:"Bearer "+second.token}});
 assert.equal(outsiderGet.status,404,"Cross-project access must be concealed");
 const outsiderAssets=await fetch(baseUrl+"/v1/assets",{headers:{Authorization:"Bearer "+second.token}});
 assert.equal(outsiderAssets.status,200);
 assert.equal((await outsiderAssets.json()).length,0,"Global asset listing must not leak other projects");
 const outsiderJobs=await fetch(baseUrl+"/v1/generation-jobs",{headers:{Authorization:"Bearer "+second.token}});
 assert.equal(outsiderJobs.status,200);
 assert.equal((await outsiderJobs.json()).length,0,"Global generation-job listing must not leak other projects");
 const outsiderMemory=await fetch(baseUrl+"/v1/memory/search?q=private",{headers:{Authorization:"Bearer "+second.token}});
 assert.equal(outsiderMemory.status,403,"Global memory search requires project scope");
 const outsiderProviders=await fetch(baseUrl+"/v1/providers",{headers:{Authorization:"Bearer "+second.token}});
 assert.equal(outsiderProviders.status,403,"Provider configuration is admin-only");
 const outsiderCache=await fetch(baseUrl+"/v1/intelligence/cache/ci-key",{headers:{Authorization:"Bearer "+second.token}});
 assert.equal(outsiderCache.status,403,"Global cache reads are admin-only");
 await request("POST",`/v1/projects/${project.id}/members`,{email:"reviewer@ci.aivedio.test",role:"reviewer"},201);
 const reviewerGet=await fetch(baseUrl+`/v1/projects/${project.id}`,{headers:{Authorization:"Bearer "+second.token}});
 assert.equal(reviewerGet.status,200,"Project reviewer can read project");
 const forbiddenProviderRoute=await fetch(baseUrl+"/v1/providers/route",{method:"POST",headers:{Authorization:"Bearer "+second.token,"Content-Type":"application/json"},body:JSON.stringify({task:"video"})});
 assert.equal(forbiddenProviderRoute.status,403,"Provider routing is admin-only");
 const workerRun=await request("POST","/v1/workflows",{projectId:project.id,name:"CI worker guard",graph:{nodes:[]}},201);
 const forbiddenTransition=await fetch(baseUrl+"/v1/workflows/"+workerRun.id+"/transition",{method:"POST",headers:{Authorization:"Bearer "+second.token,"Content-Type":"application/json"},body:JSON.stringify({status:"running"})});
 assert.equal(forbiddenTransition.status,403,"Workflow state transitions are restricted to admins/trusted workers");
 const forbiddenCheckpoint=await fetch(baseUrl+"/v1/workflows/"+workerRun.id+"/checkpoints",{method:"POST",headers:{Authorization:"Bearer "+second.token,"Content-Type":"application/json"},body:JSON.stringify({nodeId:"test",payload:{}})});
 assert.equal(forbiddenCheckpoint.status,403,"Workflow checkpoints are restricted to admins/trusted workers");
 await db.query("INSERT INTO media_providers(provider_id,name,source,descriptor) VALUES('aivedio-ci-fixture','AIVEDIO CI Fixture','test',$1::jsonb) ON CONFLICT(provider_id) DO NOTHING",[JSON.stringify({fixture:true,description:"CI-only fixture provider"})]);
 const reviewerJob=await db.query("INSERT INTO generation_jobs(project_id,task,provider_id,prompt,status,safety_status) VALUES($1,'video','aivedio-ci-fixture','review actor binding','awaiting_approval','pending') RETURNING id",[project.id]);
 const forbiddenJobTransition=await fetch(baseUrl+"/v1/generation-jobs/"+reviewerJob.rows[0].id+"/transition",{method:"POST",headers:{Authorization:"Bearer "+second.token,"Content-Type":"application/json"},body:JSON.stringify({status:"completed",result:{spoofed:true}})});
 assert.equal(forbiddenJobTransition.status,403,"Project reviewer cannot impersonate generation worker");
 const approvedJob=await fetch(baseUrl+"/v1/generation-jobs/"+reviewerJob.rows[0].id+"/review",{method:"POST",headers:{Authorization:"Bearer "+second.token,"Content-Type":"application/json"},body:JSON.stringify({decision:"approve",reviewer:"spoofed-reviewer",notes:"CI authorization test"})});
 assert.equal(approvedJob.status,200,"Reviewer can perform human approval");
 const boundReviewer=await db.query("SELECT reviewer FROM generation_reviews WHERE job_id=$1 ORDER BY created_at DESC LIMIT 1",[reviewerJob.rows[0].id]);
 assert.equal(boundReviewer.rows[0].reviewer,"reviewer@ci.aivedio.test","Reviewer identity must be derived from session, not request body");
 // Adversarial cross-project resource ownership tests.
 const projectB=await request("POST","/v1/projects",{title:"AIVEDIO CI isolation fixture B",mode:"flow",creativeBrief:"Isolation fixture"},201);
 const sceneB=(await db.query("INSERT INTO scenes(project_id,scene_order,title,prompt) VALUES($1,0,'Private B scene','B-only prompt') RETURNING id",[projectB.id])).rows[0].id;
 const subtitleB=(await db.query("INSERT INTO subtitle_cues(project_id,start_ms,end_ms,text) VALUES($1,0,1000,'Private B subtitle') RETURNING id",[projectB.id])).rows[0].id;
 const assetB=(await db.query("INSERT INTO media_assets(project_id,kind,status,storage_provider,storage_key,mime_type,size_bytes) VALUES($1,'video','quarantined','ci','private-b-asset','video/mp4',1) RETURNING id",[projectB.id])).rows[0].id;
 const renderB=(await db.query("INSERT INTO render_jobs(project_id,profile,options) VALUES($1,'{}','{}') RETURNING id",[projectB.id])).rows[0].id; const trackB=(await db.query("INSERT INTO timeline_tracks(project_id,name,kind) VALUES($1,'Private B track','video') RETURNING id",[projectB.id])).rows[0].id; const clipB=(await db.query("INSERT INTO timeline_clips(track_id,kind,title,timeline_duration_ms,source_duration_ms) VALUES($1,'video','Private B clip',1000,1000) RETURNING id",[trackB])).rows[0].id;
 const jobB=(await db.query("INSERT INTO generation_jobs(project_id,task,provider_id,prompt,status,safety_status) VALUES($1,'video','aivedio-ci-fixture','Private B job','awaiting_approval','pending') RETURNING id",[projectB.id])).rows[0].id;
 const workflowB=await request("POST","/v1/workflows",{projectId:projectB.id,name:"Private B workflow",graph:{nodes:[]}},201);
 const crossHeaders={Authorization:"Bearer "+second.token,"Content-Type":"application/json"};
 const crossGet=await fetch(baseUrl+`/v1/projects/${projectB.id}`,{headers:crossHeaders});assert.equal(crossGet.status,404,"Project B must be concealed from reviewer who only belongs to A");
 const crossFlowReorder=await fetch(baseUrl+`/v1/projects/${project.id}/flow/scenes/reorder`,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({scenes:[{id:sceneB,order:0,title:"stolen flow scene",prompt:"stolen",durationSeconds:99,status:"planned"}]})});assert.equal(crossFlowReorder.status,404,"Flow reorder must reject foreign scene IDs"); const verifyFlowScene=await db.query("SELECT title,prompt,duration_seconds FROM scenes WHERE id=$1",[sceneB]);assert.deepEqual(verifyFlowScene.rows[0],{title:"Private B scene",prompt:"B-only prompt",duration_seconds:10},"Foreign scene must remain unchanged after rejected reorder");
 const crossScene=await fetch(baseUrl+`/v1/scenes/${sceneB}`,{method:"PATCH",headers:crossHeaders,body:JSON.stringify({title:"stolen"})});assert.equal(crossScene.status,404,"Direct scene mutation must enforce owning-project membership");
 const crossSubtitle=await fetch(baseUrl+`/v1/subtitles/${subtitleB}`,{method:"DELETE",headers:{Authorization:"Bearer "+second.token}});const crossSubtitleBody=await crossSubtitle.text();assert.equal(crossSubtitle.status,404,`Direct subtitle deletion must enforce owning-project membership; response: ${crossSubtitleBody}`);
 const crossAssetReview=await fetch(baseUrl+`/v1/assets/${assetB}/review`,{method:"POST",headers:crossHeaders,body:JSON.stringify({decision:"reject",reviewer:"spoof",notes:"cross project"})});assert.equal(crossAssetReview.status,404,"Cross-project asset review must be concealed");
 const crossGenerationReview=await fetch(baseUrl+`/v1/generation-jobs/${jobB}/review`,{method:"POST",headers:crossHeaders,body:JSON.stringify({decision:"reject",reviewer:"spoof",notes:"cross project"})});assert.equal(crossGenerationReview.status,404,"Cross-project generation-job review must be concealed");
 const crossTrackPatch=await fetch(baseUrl+"/v1/timeline/tracks/"+trackB,{method:"PATCH",headers:crossHeaders,body:JSON.stringify({name:"stolen"})});assert.equal(crossTrackPatch.status,404,"Cross-project track mutation must be concealed"); const crossClipPatch=await fetch(baseUrl+"/v1/timeline/clips/"+clipB,{method:"PATCH",headers:crossHeaders,body:JSON.stringify({title:"stolen"})});assert.equal(crossClipPatch.status,404,"Cross-project clip mutation must be concealed"); const crossClipSplit=await fetch(baseUrl+"/v1/timeline/clips/"+clipB+"/split",{method:"POST",headers:crossHeaders,body:JSON.stringify({offsetMs:500})});assert.equal(crossClipSplit.status,404,"Cross-project clip split must be concealed"); const crossClipDelete=await fetch(baseUrl+"/v1/timeline/clips/"+clipB,{method:"DELETE",headers:{Authorization:"Bearer "+second.token}});assert.equal(crossClipDelete.status,404,"Cross-project clip deletion must be concealed"); const crossRenderGet=await fetch(baseUrl+`/v1/render-jobs/${renderB}`,{headers:crossHeaders});assert.equal(crossRenderGet.status,404,"Cross-project render-job read must be concealed");
 const crossRenderReview=await fetch(baseUrl+`/v1/render-jobs/${renderB}/review`,{method:"POST",headers:crossHeaders,body:JSON.stringify({decision:"reject",reviewer:"spoof",notes:"cross project"})});assert.equal(crossRenderReview.status,404,"Cross-project render review must be concealed");
 const crossWorkflowEvents=await fetch(baseUrl+`/v1/workflows/${workflowB.id}/events`,{headers:crossHeaders});assert.equal(crossWorkflowEvents.status,404,"Cross-project workflow events must be concealed");
 const crossWorkflowCheckpoint=await fetch(baseUrl+`/v1/workflows/${workflowB.id}/checkpoints`,{headers:crossHeaders});assert.equal(crossWorkflowCheckpoint.status,404,"Cross-project workflow checkpoints must be concealed");
 const verifyB=await db.query("SELECT title FROM scenes WHERE id=$1",[sceneB]);assert.equal(verifyB.rows[0].title,"Private B scene","Denied cross-project mutation must not change data");
 const verifySubtitle=await db.query("SELECT count(*)::int n FROM subtitle_cues WHERE id=$1",[subtitleB]);assert.equal(verifySubtitle.rows[0].n,1,"Denied cross-project deletion must preserve data");
 await db.query("INSERT INTO project_memory(project_id,kind,content,tags,importance) VALUES(NULL,'ci','private global accessaudit marker',ARRAY['ci'],0.9),($1,'ci','project scoped accessaudit marker',ARRAY['ci'],0.9)",[project.id]);
 const scopedMemory=await fetch(baseUrl+`/v1/memory/search?q=accessaudit&projectId=${project.id}`,{headers:{Authorization:"Bearer "+second.token}});
 assert.equal(scopedMemory.status,200);
 const memoryRows=await scopedMemory.json();
 assert.ok(memoryRows.results.some((m:any)=>m.content.includes("project scoped")));
 assert.equal(memoryRows.results.some((m:any)=>m.content.includes("private global")),false,"Project memory search must not leak global memory rows");
 const reviewerMembers=await fetch(baseUrl+`/v1/projects/${project.id}/members`,{headers:{Authorization:"Bearer "+second.token}});assert.equal(reviewerMembers.status,403,"Reviewer cannot manage project members");

 const editorPassword="CI-"+"Editor-"+"Password-123!";
 const editorSession=await request("POST","/v1/auth/register",{email:"editor@ci.aivedio.test",password:editorPassword,displayName:"CI Editor"},201);
 const editorToken=editorSession.token;
 await request("POST",`/v1/projects/${project.id}/members`,{email:"editor@ci.aivedio.test",role:"editor"},201);
 const isolatedProject=await request("POST","/v1/projects",{title:"CI isolated resource fixture",mode:"flow",creativeBrief:"Ownership boundary regression fixture"},201);
 const lockedTrack=await request("POST",`/v1/projects/${isolatedProject.id}/timeline/tracks`,{name:"Locked track regression",kind:"video"},201);
 const lockJob=await db.query("INSERT INTO generation_jobs(project_id,task,provider_id,prompt,status,safety_status,quality_status) VALUES($1,'video','aivedio-ci-fixture','locked-track fixture','completed','approved','pass') RETURNING id",[isolatedProject.id]);
 const lockAsset=await db.query("INSERT INTO media_assets(project_id,job_id,kind,status,storage_provider,storage_key,mime_type,size_bytes,metadata) VALUES($1,$2,'video','ready','ci-fixture','locked/asset.mp4','video/mp4',1,'{}'::jsonb) RETURNING id",[isolatedProject.id,lockJob.rows[0].id]);
 const lockClipResponse=await fetch(baseUrl+`/v1/timeline/tracks/${lockedTrack.id}/clips`,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({title:"Lock regression clip",kind:"video",assetId:lockAsset.rows[0].id,timelineDurationMs:2000,sourceDurationMs:2000})});
 assert.equal(lockClipResponse.status,201,"Admin can create a clip on an unlocked track");
 const lockClip=await lockClipResponse.json();
 const lockedTrackResponse=await fetch(baseUrl+`/v1/timeline/tracks/${lockedTrack.id}`,{method:"PATCH",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({locked:true})});
 assert.equal(lockedTrackResponse.status,200,"Track lock should persist");
 const lockedCreate=await fetch(baseUrl+`/v1/timeline/tracks/${lockedTrack.id}/clips`,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({title:"Locked create",kind:"video",assetId:lockAsset.rows[0].id,timelineDurationMs:1000,sourceDurationMs:1000})});
 assert.equal(lockedCreate.status,400,"Locked tracks must reject clip creation");
 const lockedUpdate=await fetch(baseUrl+`/v1/timeline/clips/${lockClip.id}`,{method:"PATCH",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({title:"Locked edit"})});
 assert.equal(lockedUpdate.status,400,"Locked tracks must reject clip updates");
 const lockedSplit=await fetch(baseUrl+`/v1/timeline/clips/${lockClip.id}/split`,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({offsetMs:500})});
 assert.equal(lockedSplit.status,400,"Locked tracks must reject clip splits");
 const lockedTrim=await fetch(baseUrl+`/v1/timeline/clips/${lockClip.id}/trim`,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({startMs:100,endMs:100})});
 assert.equal(lockedTrim.status,400,"Locked tracks must reject clip trims");
 const lockedDelete=await fetch(baseUrl+`/v1/timeline/clips/${lockClip.id}`,{method:"DELETE",headers:{Authorization:"Bearer "+token}});
 assert.equal(lockedDelete.status,400,"Locked tracks must reject clip deletion");
 await fetch(baseUrl+`/v1/timeline/tracks/${lockedTrack.id}`,{method:"PATCH",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({locked:false})});
 const isolatedJob=await db.query("INSERT INTO generation_jobs(project_id,task,provider_id,prompt,status,safety_status,quality_status) VALUES($1,'video','aivedio-ci-fixture','ownership boundary fixture','completed','approved','pass') RETURNING id",[isolatedProject.id]);
 const isolatedAsset=await db.query("INSERT INTO media_assets(project_id,job_id,kind,status,storage_provider,storage_key,mime_type,size_bytes,metadata) VALUES($1,$2,'video','ready','ci-fixture','isolated/asset.mp4','video/mp4',1,'{}'::jsonb) RETURNING id",[isolatedProject.id,isolatedJob.rows[0].id]);
 const crossProjectAssetReview=await fetch(baseUrl+"/v1/assets/"+isolatedAsset.rows[0].id+"/review",{method:"POST",headers:{Authorization:"Bearer "+second.token,"Content-Type":"application/json"},body:JSON.stringify({decision:"approve",reviewer:"spoofed"})});
 assert.equal(crossProjectAssetReview.status,404,"Direct asset ID must not bypass project ownership");
 const nestedCrossProjectAnalysis=await fetch(baseUrl+"/v1/projects/"+project.id+"/assets/"+isolatedAsset.rows[0].id+"/analyze",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({kinds:["metadata"]})});
 assert.equal(nestedCrossProjectAnalysis.status,400,"Project-scoped asset operation must reject a foreign asset ID");
 // Phase 22 cross-project resource-ownership regressions. Use an editor token:
 // reviewers are intentionally read-only except for review/approval actions.
 const ownedTrackResponse=await fetch(baseUrl+`/v1/projects/${project.id}/timeline/tracks`,{method:"POST",headers:{Authorization:"Bearer "+editorToken,"Content-Type":"application/json"},body:JSON.stringify({name:"Ownership test track",kind:"video"})});
 assert.equal(ownedTrackResponse.status,201,"Editor may create a timeline track");
 const ownedTrack=await ownedTrackResponse.json();
 const foreignTrack=await db.query("INSERT INTO timeline_tracks(project_id,name,kind) VALUES($1,'Foreign audio track','audio') RETURNING id",[isolatedProject.id]);
 const foreignSubtitle=await db.query("INSERT INTO subtitle_cues(project_id,start_ms,end_ms,text) VALUES($1,0,1000,'foreign subtitle marker') RETURNING id",[isolatedProject.id]);
 const subtitleCollision=await fetch(baseUrl+`/v1/projects/${project.id}/subtitles`,{method:"POST",headers:{Authorization:"Bearer "+editorToken,"Content-Type":"application/json"},body:JSON.stringify({id:foreignSubtitle.rows[0].id,startMs:0,endMs:1000,text:"attempted overwrite"})});
 assert.equal(subtitleCollision.status,400,"Subtitle upsert must reject IDs owned by another project");
 const subtitleAfter=await db.query("SELECT project_id,text FROM subtitle_cues WHERE id=$1",[foreignSubtitle.rows[0].id]);
 assert.equal(subtitleAfter.rows[0].project_id,isolatedProject.id,"Cross-project subtitle collision must preserve ownership");assert.equal(subtitleAfter.rows[0].text,"foreign subtitle marker","Cross-project subtitle collision must not overwrite content");
 const foreignAssetClip=await fetch(baseUrl+`/v1/timeline/tracks/${ownedTrack.id}/clips`,{method:"POST",headers:{Authorization:"Bearer "+editorToken,"Content-Type":"application/json"},body:JSON.stringify({title:"Foreign asset attempt",kind:"video",assetId:isolatedAsset.rows[0].id,timelineDurationMs:1000,sourceDurationMs:1000})});
 assert.equal(foreignAssetClip.status,400,"Timeline clip creation must reject assets owned by another project");
 const foreignScene=await db.query("INSERT INTO scenes(project_id,scene_order,title,prompt) VALUES($1,999,'Foreign scene fixture','') RETURNING id",[isolatedProject.id]);
 const unsafeJob=await db.query("INSERT INTO generation_jobs(project_id,task,provider_id,prompt,status,safety_status,quality_status) VALUES($1,'video','aivedio-ci-fixture','render release gate','completed','approved','pass') RETURNING id",[isolatedProject.id]);
 const unsafeAsset=await db.query("INSERT INTO media_assets(project_id,job_id,kind,status,storage_provider,storage_key,mime_type,size_bytes,metadata) VALUES($1,$2,'video','ready','ci-fixture','unsafe/render.mp4','video/mp4',1,'{}'::jsonb) RETURNING id",[isolatedProject.id,unsafeJob.rows[0].id]);
 await db.query("INSERT INTO quality_reports(project_id,asset_id,stage,status,score,action,safety_verdict,report) VALUES($1,$2,'asset','fail',0,'block','uncertain',$3::jsonb)",[isolatedProject.id,unsafeAsset.rows[0].id,JSON.stringify({fixture:true,findings:[{code:"CI_FAIL"}]})]);
 const unsafeTrack=await request("POST",`/v1/projects/${isolatedProject.id}/timeline/tracks`,{name:"Unsafe render test",kind:"video"},201);
 const unsafeClip=await request("POST",`/v1/timeline/tracks/${unsafeTrack.id}/clips`,{title:"Unsafe fixture",kind:"video",assetId:unsafeAsset.rows[0].id,timelineDurationMs:1000,sourceDurationMs:1000},201);
 const unsafeRender=await fetch(baseUrl+`/v1/projects/${isolatedProject.id}/render-jobs`,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({options:{subtitleMode:"none"}})});
 assert.equal(unsafeRender.status,400,"Render creation must reject assets with failed QA or uncleared safety review");
 await db.query("UPDATE media_assets SET status='quarantined' WHERE id=$1",[unsafeAsset.rows[0].id]);
 const unsafeAssetApproval=await fetch(baseUrl+"/v1/assets/"+unsafeAsset.rows[0].id+"/review",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({decision:"approve",reviewer:"CI"})});
 assert.equal(unsafeAssetApproval.status,400,"Asset release must reject failed technical QA and uncleared safety review");
 const foreignSceneClip=await fetch(baseUrl+`/v1/timeline/tracks/${ownedTrack.id}/clips`,{method:"POST",headers:{Authorization:"Bearer "+editorToken,"Content-Type":"application/json"},body:JSON.stringify({title:"Foreign scene attempt",kind:"video",sceneId:foreignScene.rows[0].id,timelineDurationMs:1000,sourceDurationMs:1000})});
 assert.equal(foreignSceneClip.status,400,"Timeline clip creation must reject scenes owned by another project");
 const foreignMix=await fetch(baseUrl+`/v1/projects/${project.id}/audio-mix`,{method:"PUT",headers:{Authorization:"Bearer "+editorToken,"Content-Type":"application/json"},body:JSON.stringify({trackId:foreignTrack.rows[0].id,gainDb:0,muted:false})});
 assert.equal(foreignMix.status,400,"Audio mix settings must reject tracks owned by another project");

 const reviewerEdit=await fetch(baseUrl+`/v1/projects/${project.id}`,{method:"PATCH",headers:{Authorization:"Bearer "+second.token,"Content-Type":"application/json"},body:JSON.stringify({title:"Unauthorized change"})});
 assert.equal(reviewerEdit.status,403,"Reviewer cannot edit project");
 const planRow=await request("POST",`/v1/projects/${project.id}/creative-plans`,{
  format:"advertisement",targetDurationSeconds:30,language:"English",audience:"General public",
  genre:["public-service"],mood:["hopeful"]
 },201);
 assert.ok(planRow.id&&planRow.plan?.scenes?.length,"Creative planning must persist a structured plan");
 const plan=planRow.plan;
 await request("POST",`/v1/projects/${project.id}/creative-plans/${planRow.id}/approve`,{reviewer:"AIVEDIO CI reviewer"},200);

 const scriptContent={
  title:"Water Conservation — CI Draft",
  logline:"A community makes water conservation a shared daily habit.",
  synopsis:"A short fictional public-service advertisement with a clear call to action.",
  scenes:plan.scenes.map((scene:any)=>({
   sceneId:scene.id,slugline:scene.title,action:scene.action,dialogue:[],onScreenText:[],durationSeconds:scene.durationSeconds
  })),
  shots:plan.scenes.flatMap((scene:any)=>scene.shots.map((shot:any)=>({
   shotId:shot.id,sceneId:scene.id,generationPrompt:shot.generationPrompt,
   negativePrompt:"No fabricated logos, captions or watermarks.",referenceIds:[],continuityChecks:["Keep scene geography and visual style consistent."]
  }))),
  musicArc:plan.scenes.map((scene:any)=>({sceneId:scene.id,direction:scene.musicDirection,intensity:0.5})),
  soundDesign:plan.scenes.map((scene:any)=>({sceneId:scene.id,effects:[],ambience:"Soft community ambience"})),
  factualClaims:[],assumptions:["Fictional demonstration content."],openQuestions:[]
 };
 const validation={valid:true,errors:[],confidence:{sceneCoverage:1,shotCoverage:1,citationCoverage:1,referenceCoverage:1}};
 const packageInsert=await db.query(
  `INSERT INTO creative_script_packages(project_id,plan_id,version,status,model_id,pricing_free_verified,content,research,confidence,validation)
   VALUES($1,$2,1,'awaiting_review','ci-fixture-model',true,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb) RETURNING id`,
  [project.id,planRow.id,JSON.stringify(scriptContent),JSON.stringify({required:false,sources:[]}),JSON.stringify(validation.confidence),JSON.stringify(validation)]
 );
 const scriptPackageId=packageInsert.rows[0].id;
 await request("POST",`/v1/projects/${project.id}/script-packages/${scriptPackageId}/review`,{
  decision:"approve",reviewer:"AIVEDIO CI reviewer",notes:"Fixture package reviewed for integration testing."
 },200);
 const reviewedPackage=await db.query("SELECT reviewed_by FROM creative_script_packages WHERE id=$1",[scriptPackageId]);
 assert.equal(reviewedPackage.rows[0].reviewed_by,"admin@ci.aivedio.test","Review actor must be bound to authenticated identity");

 await db.query(
  `INSERT INTO media_providers(provider_id,name,source,descriptor)
   VALUES('aivedio-ci-fixture','AIVEDIO CI Fixture','test',$1::jsonb)
   ON CONFLICT(provider_id) DO NOTHING`,
  [JSON.stringify({fixture:true,description:"CI-only synthetic media rows; no external provider call."})]
 );
 await db.query("UPDATE media_providers SET descriptor=$2::jsonb WHERE provider_id=$1",["aivedio-ci-fixture",JSON.stringify({id:"aivedio-ci-fixture",name:"AIVEDIO CI Fixture",source:"manual",capabilities:[{task:"video",inputs:["prompt"],outputs:["video"],maxDurationSeconds:120,aspectRatios:["16:9"],resolutions:["720p","1080p"],supportsReferences:true,supportsAudio:false}],authRequired:false,authConfigured:false,pricing:{free:true,verifiedAt:new Date().toISOString()},trust:{verified:true,score:100,notes:["Synthetic CI-only provider"]},availability:"available"})]);
 const validGeneration=await fetch(baseUrl+"/v1/generation-jobs",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({projectId:project.id,task:"video",prompt:"CI generation ownership test",freeOnly:false})});
 assert.equal(validGeneration.status,201,"Valid project generation job should be created with the test provider");
 const foreignSceneGeneration=await fetch(baseUrl+"/v1/generation-jobs",{method:"POST",headers:{Authorization:"Bearer "+editorToken,"Content-Type":"application/json"},body:JSON.stringify({projectId:project.id,sceneId:foreignScene.rows[0].id,task:"video",prompt:"Foreign scene attempt",freeOnly:false})});
 assert.equal(foreignSceneGeneration.status,400,"Generation jobs must reject scenes from another project");
 const foreignAssetGeneration=await fetch(baseUrl+"/v1/generation-jobs",{method:"POST",headers:{Authorization:"Bearer "+editorToken,"Content-Type":"application/json"},body:JSON.stringify({projectId:project.id,inputAssets:[isolatedAsset.rows[0].id],task:"video",prompt:"Foreign asset attempt",freeOnly:false})});
 assert.equal(foreignAssetGeneration.status,400,"Generation jobs must reject input assets from another project");
 const assetAssignments:Record<string,string>={};
 const shots=plan.scenes.flatMap((scene:any)=>scene.shots.map((shot:any)=>({scene,shot})));
 for(const {scene,shot} of shots){
  const job=await db.query(
   `INSERT INTO generation_jobs(project_id,task,provider_id,prompt,status,safety_status,quality_status,completed_at)
    VALUES($1,'video','aivedio-ci-fixture',$2,'completed','approved','pass',now()) RETURNING id`,
   [project.id,shot.generationPrompt]
  );
  const asset=await db.query(
   `INSERT INTO media_assets(project_id,job_id,kind,status,storage_provider,storage_key,mime_type,size_bytes,metadata)
    VALUES($1,$2,'video','ready','ci-fixture',$3,'video/mp4',1,$4::jsonb) RETURNING id`,
   [project.id,job.rows[0].id,`ci-fixture/${shot.id}.mp4`,JSON.stringify({shotId:shot.id,planSceneId:scene.id,durationSeconds:120,fixture:true})]
  );
  assetAssignments[shot.id]=asset.rows[0].id;
  await db.query(
   `INSERT INTO quality_reports(project_id,asset_id,stage,status,score,action,safety_verdict,report)
    VALUES($1,$2,'asset','pass',100,'allow','clear',$3::jsonb)`,
   [project.id,asset.rows[0].id,JSON.stringify({fixture:true,findings:[]})]
  );
 }

 const cut=await request("POST",`/v1/projects/${project.id}/production-cuts`,{
  scriptPackageId,assetAssignments,createdBy:"AIVEDIO CI"
 },201);
 assert.equal(cut.readiness,"ready","Cut must be fully asset-matched and pass QA/safety candidate checks");
 const applied=await request("POST",`/v1/projects/${project.id}/production-cuts/${cut.id}/apply`,{},200);
 assert.equal(applied.createdClips,shots.length,"Applying the cut must create one timeline clip per planned shot");

 const timeline=await request("GET",`/v1/projects/${project.id}/timeline`,undefined,200);
 assert.equal(timeline.clips.length,shots.length,"Timeline must contain all production-cut clips");
 const manifest=await request("GET",`/v1/projects/${project.id}/timeline/manifest`,undefined,200);
 assert.equal(manifest.validation.valid,true,"Timeline edit manifest must validate");

 const audioPlan=await request("POST",`/v1/projects/${project.id}/production-cuts/${cut.id}/audio-plans`,{createdBy:"AIVEDIO CI"},201);
 assert.ok(audioPlan.content?.cues?.length>0,"Audio plan must contain reviewable script-derived cues");
 const audioApproval=await fetch(baseUrl+`/v1/projects/${project.id}/audio-plans/${audioPlan.id}/review`,{
  method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
  body:JSON.stringify({decision:"approve",reviewer:"AIVEDIO CI reviewer"})
 });
 const audioApprovalText=await audioApproval.text();
 assert.equal(audioApproval.status,400,"Unassigned/unreviewed audio cues must remain behind the HITL approval gate");
 assert.match(audioApprovalText,/reviewed timing|released audio assets/i,"Audio rejection should explain the missing human-reviewed inputs");

 const render=await request("POST",`/v1/projects/${project.id}/render-jobs`,{options:{subtitleMode:"none"}},201);
 assert.ok(render.id&&render.manifest,"Render job must persist a validated timeline snapshot");
 const prematureReview=await fetch(baseUrl+`/v1/render-jobs/${render.id}/review`,{
  method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
  body:JSON.stringify({decision:"approve",reviewer:"AIVEDIO CI reviewer"})
 });
 assert.equal(prematureReview.status,400,"Queued renders must not be deliverable");

 // Simulate the persisted result of a successful worker run. This deliberately
 // does not claim to execute FFmpeg; worker/media integration has its own gate.
 await db.query(
  "UPDATE render_jobs SET status='awaiting_review',stage='awaiting_review',qa_status='fail',output_storage_key='ci-fixture/failed.mp4' WHERE id=$1",
  [render.id]
 );
 const failedQaReview=await fetch(baseUrl+`/v1/render-jobs/${render.id}/review`,{
  method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
  body:JSON.stringify({decision:"approve",reviewer:"AIVEDIO CI reviewer"})
 });
 assert.equal(failedQaReview.status,400,"Render output that failed QA must not be approved");
 await db.query(
  "UPDATE render_jobs SET qa_status='pass',output_storage_key='ci-fixture/approved.mp4',output_checksum='fixture-checksum',output_size_bytes=1 WHERE id=$1",
  [render.id]
 );
 const delivered=await request("POST",`/v1/render-jobs/${render.id}/review`,{
  decision:"approve",reviewer:"AIVEDIO CI reviewer",notes:"Approved after fixture QA passed."
 },200);
 assert.equal(delivered.status,"completed","Human approval should complete a QA-passed render delivery");
 const deniedTransfer=await fetch(baseUrl+`/v1/projects/${project.id}/transfer-owner`,{method:"POST",headers:{"Authorization":"Bearer "+second.token,"Content-Type":"application/json"},body:JSON.stringify({userId:second.user.id})});
 assert.equal(deniedTransfer.status,403,"Only an administrator may transfer project ownership");
 const transfer=await request("POST",`/v1/projects/${project.id}/transfer-owner`,{userId:second.user.id},200);
 assert.equal(transfer.role,"owner","Admin ownership transfer must promote the target member");
 const newOwnerRole=await fetch(baseUrl+`/v1/projects/${project.id}/role`,{headers:{"Authorization":"Bearer "+second.token}});
 assert.equal((await newOwnerRole.json()).role,"owner","Transferred owner must receive owner role");

 console.log("AIVEDIO E2E smoke passed: project → plan → script review → QA/safety-gated assets → production cut → timeline → audio HITL gate → render snapshot → delivery review.");
 console.log("Note: generated media and worker render output are fixtures; provider generation and FFmpeg execution are not simulated as real work.");
}catch(error){
 console.error(error);
 console.error("API process output:\n"+serverOutput);
 process.exitCode=1;
}finally{
 api.kill("SIGTERM");
 await new Promise(resolve=>{if(api.exitCode!==null)return resolve(undefined);const timer=setTimeout(resolve,3000);api.once("exit",()=>{clearTimeout(timer);resolve(undefined)})});
 await db.end();
}
