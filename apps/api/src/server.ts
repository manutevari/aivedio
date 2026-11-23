import Fastify from "fastify";
import {loadApiSecurityConfig} from "./security-config.js";
import {AuthRateLimiter} from "./auth-rate-limit.js";
import {bootstrapAdmin,registerUser,loginUser,authenticateSession,revokeSession,getProjectRole,addProjectMember,listProjectMembers,removeProjectMember,transferProjectOwnership} from "./auth.js";
import type {AuthUser} from "./auth.js";
import {requestAssetAnalysis,listAssetAnalysis,getAssetAnalysis,getAssetIntelligence,searchMediaChunks,listKeyframes} from './asset-intelligence.js';
import {createAssetQualityJob,listQualityJobs,listQualityReports,getQualityReport,runContinuityReview,applySafetyReview,listSafetyReviews} from './quality.js';
import {enrichCreativePlan,listScriptPackages,getScriptPackage,reviewScriptPackage} from './scriptwriting.js';
import {createPlan,listPlans,getPlan,updatePlan,approvePlan,createPlanRevision} from './creative-plans.js';
import { classifyNode, decideNextAction, analyzeCreativeBrief, optimizeContext, buildProductionGraph, continuityChecklist, routeCapability } from "@aivedio/core";
import {pool,requireDb} from "./db.js";
import {listProjects,createProject,getProject,updateProject,listScenes,createScene,updateScene,deleteScene} from "./projects.js";
import {createRun,transitionRun,saveCheckpoint} from "./workflows.js";
import {saveMemory,searchMemory,logQuery,cacheGet,cacheSet} from "./intelligence.js";
import {discoverOpenRouterModels,getFreeModels,routeFreeLLM} from "./models.js";
import {createCharacter,listCharacters,createReference,listReferences,replaceFlowScenes,listFlowScenes} from "./flow.js";
import {listProviders,upsertProvider,routeRequest,createGenerationJob,getGenerationJob,transitionGenerationJob} from "./providers.js";
import {discoveryCandidate,registerDiscoveredProvider,getDiscoveredProviders} from "./mcp-registry.js";
import {listGenerationJobs,reviewGenerationJob,listProjectAssets,listProjectAssetsGlobal,reviewAsset} from "./reviews.js";
import {parseReview} from "./validation.js";
import {listEditDecisions,saveEditDecision,listSubtitles,upsertSubtitle,deleteSubtitle,getMixSettings,saveMixSetting} from "./editing.js";
import {getTimeline,createTrack,updateTrack,createClip,updateClip,deleteClip,splitClip,trimClip,createRenderJob,listRenderJobs,getRenderJob} from "./timeline.js";
import {createProductionCut,listProductionCuts,getProductionCut,applyProductionCut,getTimelineEditManifest} from "./production-cuts.js";
import {createAudioPlan,listAudioPlans,getAudioPlan,updateAudioCue,reviewAudioPlan,applyAudioPlan,requestAudioAnalysis,listAudioAnalysis,listAudioAnalysisJobs,getAudioAnalysis,saveDucking} from "./audio-intelligence.js";
import {createRenderJobFromTimeline} from "./rendering.js";
import {reviewRenderJob} from "./timeline.js";



const app=Fastify({logger:true});
const securityConfig=loadApiSecurityConfig(process.env);
const allowedOrigins=securityConfig.allowedOrigins;
const authLimiter=new AuthRateLimiter(10000);
app.addHook("onRequest",async(request,reply)=>{
 reply.header("X-Content-Type-Options","nosniff");
 reply.header("X-Frame-Options","DENY");
 reply.header("Referrer-Policy","no-referrer");
 reply.header("Permissions-Policy","camera=(),microphone=(),geolocation=()");
});
app.addHook("preHandler",async(request,reply)=>{
 const origin=request.headers.origin;
 if(origin&&allowedOrigins.includes(origin)){reply.header("Access-Control-Allow-Origin",origin);reply.header("Vary","Origin");reply.header("Access-Control-Allow-Headers","Authorization,Content-Type");reply.header("Access-Control-Allow-Methods","GET,POST,PUT,PATCH,DELETE,OPTIONS");}
 if(request.method==="OPTIONS")return reply.code(204).send();
 if(request.url==="/health"||request.url==="/ready")return;
 const pathname=request.url.split("?")[0]??"/";
 if(["/v1/auth/login","/v1/auth/register","/v1/auth/bootstrap"].includes(pathname)){const key=pathname+":"+request.ip;const decision=authLimiter.allow(key,pathname.endsWith("login")?8:4,15*60*1000);if(!decision.allowed){reply.header("Retry-After",String(Math.ceil(decision.retryAfterMs/1000)));return reply.code(429).send({error:"Too many authentication attempts. Try again later."});}return;}
 const bearer=request.headers.authorization?.startsWith("Bearer ")?request.headers.authorization.slice(7):"";
 let user:AuthUser|null=null;
 try{user=await authenticateSession(bearer)}catch(error){request.log.error(error);return reply.code(500).send({error:"Authentication service unavailable"})}
 if(!user)return reply.code(401).send({error:"Session required"});
 (request as any).user=user;
 const parts=pathname.split("/").filter(Boolean);
 const pathProject=parts[0]==="v1"&&parts[1]==="projects"?parts[2]:undefined;
 const queryProject=(request.query as any)?.projectId;const bodyProject=(request.body as any)?.projectId;
 const explicitProject=pathProject??(queryProject?String(queryProject):undefined)??(bodyProject?String(bodyProject):undefined);
 let resourceProject:string|undefined,resourceMissing=false;
 const tableByType:Record<string,string>={assets:"media_assets","generation-jobs":"generation_jobs","render-jobs":"render_jobs",scenes:"scenes",subtitles:"subtitle_cues"};
 const resourceKind=parts[1]??"",resourceId=parts[2];
 const table=tableByType[resourceKind];
 if(table&&resourceId&&resourceId!=="review"){
  try{const r=await requireDb().query("SELECT project_id FROM "+table+" WHERE id=$1",[resourceId]);resourceProject=r.rows[0]?.project_id;resourceMissing=!resourceProject}catch{resourceMissing=true}
 }
 if(resourceKind==="timeline"&&parts[2]==="tracks"&&parts[3]){
  try{const r=await requireDb().query("SELECT project_id FROM timeline_tracks WHERE id=$1",[parts[3]]);resourceProject=r.rows[0]?.project_id;resourceMissing=!resourceProject}catch{resourceMissing=true}
 }
 if(resourceKind==="timeline"&&parts[2]==="clips"&&parts[3]){
  try{const r=await requireDb().query("SELECT t.project_id FROM timeline_clips c JOIN timeline_tracks t ON t.id=c.track_id WHERE c.id=$1",[parts[3]]);resourceProject=r.rows[0]?.project_id;resourceMissing=!resourceProject}catch{resourceMissing=true}
 }
 if(resourceKind==="workflows"&&resourceId){
  try{const r=await requireDb().query("SELECT project_id FROM workflow_runs WHERE id=$1",[resourceId]);resourceProject=r.rows[0]?.project_id??undefined;resourceMissing=!resourceProject}catch{resourceMissing=true}
 }
 if(resourceMissing)return reply.code(404).send({error:"Resource not found"});
 if(resourceProject&&explicitProject&&resourceProject!==explicitProject)return reply.code(404).send({error:"Resource not found"});
 let projectId=pathProject??resourceProject??explicitProject;
 if(projectId&&request.body&&typeof request.body==="object"&&(request.method==="POST"||request.method==="PUT"||request.method==="PATCH"))(request.body as any).createdBy=user.email;
 if(request.body&&typeof request.body==="object"&&/(review|approve|safety-review)$/.test(pathname))(request.body as any).reviewer=user.email;
 if(user.global_role!=="admin"){
  if(pathname.startsWith("/v1/providers")||pathname.startsWith("/v1/intelligence/cache/"))return reply.code(403).send({error:"Admin role required"});
  if((pathname.startsWith("/v1/generation-jobs/")&&pathname.endsWith("/transition"))||(pathname.startsWith("/v1/workflows/")&&(pathname.endsWith("/transition")||pathname.endsWith("/checkpoints"))))return reply.code(403).send({error:"Admin role required for worker operations"});
  if(pathname==="/v1/memory/search"&&!projectId)return reply.code(403).send({error:"Project scope required"});
  if(pathname.startsWith("/v1/workflows/")&&!projectId)return reply.code(403).send({error:"Project scope required"});
 }
 if(!projectId&&request.method!=="GET"&&pathname!=="/v1/projects"&&pathname!=="/v1/auth/logout"&&user.global_role!=="admin")return reply.code(403).send({error:"Admin role required for global mutation"});
 if(projectId){
  const role=await getProjectRole(user,projectId);if(!role)return reply.code(404).send({error:"Project not found"});
  const readOnly=request.method==="GET",reviewerAction=/\/review$|safety-review|\/approve$/.test(pathname);
  const canEdit=["owner","editor"].includes(role),canReview=["owner","editor","reviewer"].includes(role);
  if(!readOnly&&!(reviewerAction?canReview:canEdit))return reply.code(403).send({error:"Insufficient project role"});
 }
});app.post("/v1/projects/:id/production-cuts/:cutId/audio-plans",async(request,reply)=>{try{const p=request.params as {id:string;cutId:string};const b=request.body as {assetAssignments?:Record<string,string>;createdBy?:string};return reply.status(201).send(await createAudioPlan(p.id,p.cutId,b?.assetAssignments??{},b?.createdBy))}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.get("/v1/projects/:id/audio-plans",async(request)=>listAudioPlans((request.params as {id:string}).id));
app.get("/v1/projects/:id/audio-plans/:planId",async(request,reply)=>{const p=request.params as {id:string;planId:string};const r=await getAudioPlan(p.id,p.planId);if(!r)return reply.status(404).send({error:"Audio plan not found"});return r});
app.patch("/v1/projects/:id/audio-plans/:planId/cues/:cueId",async(request,reply)=>{try{const p=request.params as {id:string;planId:string;cueId:string};return await updateAudioCue(p.id,p.planId,p.cueId,request.body as any)}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.post("/v1/projects/:id/audio-plans/:planId/review",async(request,reply)=>{try{const p=request.params as {id:string;planId:string};const b=request.body as {decision:"approve"|"reject";reviewer:string;notes?:string};return await reviewAudioPlan(p.id,p.planId,b.decision,b.reviewer,b.notes)}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.post("/v1/projects/:id/audio-plans/:planId/apply",async(request,reply)=>{try{const p=request.params as {id:string;planId:string};return await applyAudioPlan(p.id,p.planId)}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.post("/v1/projects/:id/assets/:assetId/audio-analysis",async(request,reply)=>{try{const p=request.params as {id:string;assetId:string};return reply.status(202).send(await requestAudioAnalysis(p.id,p.assetId,(request.body as any)?.thresholds??{}))}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.get("/v1/projects/:id/audio-analysis",async(request)=>{const p=request.params as {id:string};const q=request.query as {assetId?:string};return listAudioAnalysis(p.id,q.assetId)});
app.get("/v1/projects/:id/audio-analysis/jobs",async(request)=>listAudioAnalysisJobs((request.params as {id:string}).id));
app.get("/v1/projects/:id/audio-analysis/:reportId",async(request,reply)=>{const p=request.params as {id:string;reportId:string};const r=await getAudioAnalysis(p.id,p.reportId);if(!r)return reply.status(404).send({error:"Audio analysis report not found"});return r});
app.put("/v1/projects/:id/audio-mix/:trackId/ducking",async(request,reply)=>{try{const p=request.params as {id:string;trackId:string};return await saveDucking(p.id,p.trackId,request.body as any)}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.post("/v1/projects/:id/production-cuts",async(request,reply)=>{try{const p=request.params as {id:string};const b=request.body as {scriptPackageId:string;assetAssignments?:Record<string,string>;createdBy?:string};return reply.status(201).send(await createProductionCut(p.id,b))}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.get("/v1/projects/:id/production-cuts",async(request)=>listProductionCuts((request.params as {id:string}).id));
app.get("/v1/projects/:id/production-cuts/:cutId",async(request,reply)=>{const p=request.params as {id:string;cutId:string};const r=await getProductionCut(p.id,p.cutId);if(!r)return reply.status(404).send({error:"Production cut not found"});return r});
app.post("/v1/projects/:id/production-cuts/:cutId/apply",async(request,reply)=>{try{const p=request.params as {id:string;cutId:string};return await applyProductionCut(p.id,p.cutId)}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.get("/v1/projects/:id/timeline/manifest",async(request)=>getTimelineEditManifest((request.params as {id:string}).id));
app.post("/v1/projects/:id/quality/assets/:assetId/jobs",async(request,reply)=>{try{const p=request.params as {id:string;assetId:string};const b=request.body as {expectedProfile?:Record<string,unknown>;requestedBy?:string};return reply.status(201).send(await createAssetQualityJob(p.id,p.assetId,b?.expectedProfile??{},b?.requestedBy))}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.get("/v1/projects/:id/quality/jobs",async(request)=>listQualityJobs((request.params as {id:string}).id));
app.get("/v1/projects/:id/quality/reports",async(request)=>{const p=request.params as {id:string};const q=request.query as {assetId?:string};return listQualityReports(p.id,q.assetId)});
app.get("/v1/projects/:id/quality/reports/:reportId",async(request,reply)=>{const p=request.params as {id:string;reportId:string};const r=await getQualityReport(p.id,p.reportId);if(!r)return reply.status(404).send({error:"Quality report not found"});return r});
app.post("/v1/projects/:id/quality/continuity",async(request,reply)=>{try{const p=request.params as {id:string};const b=request.body as {snapshots:any[]};if(!Array.isArray(b?.snapshots))return reply.status(400).send({error:"snapshots array required"});return reply.status(201).send(await runContinuityReview(p.id,b.snapshots))}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.get("/v1/projects/:id/safety/reviews",async(request)=>listSafetyReviews((request.params as {id:string}).id));
app.post("/v1/projects/:id/quality/reports/:reportId/safety-review",async(request,reply)=>{try{const p=request.params as {id:string;reportId:string};return await applySafetyReview(p.id,p.reportId,request.body as any)}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.get("/v1/projects/:id/edit-decisions",async(request)=>listEditDecisions((request.params as {id:string}).id));
app.post("/v1/projects/:id/edit-decisions",async(request,reply)=>{try{return reply.status(201).send(await saveEditDecision((request.params as {id:string}).id,request.body as any))}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.get("/v1/projects/:id/subtitles",async(request)=>listSubtitles((request.params as {id:string}).id));
app.post("/v1/projects/:id/subtitles",async(request,reply)=>{try{return reply.status(201).send(await upsertSubtitle((request.params as {id:string}).id,request.body as any))}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.delete("/v1/subtitles/:id",async(request,reply)=>{if(!await deleteSubtitle((request.params as {id:string}).id))return reply.status(404).send({error:"Subtitle not found"});return {deleted:true}});
app.get("/v1/projects/:id/audio-mix",async(request)=>getMixSettings((request.params as {id:string}).id));
app.put("/v1/projects/:id/audio-mix",async(request,reply)=>{try{return reply.status(200).send(await saveMixSetting((request.params as {id:string}).id,request.body as any))}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});



app.get("/health",async()=>({status:"ok",service:"aivedio-api",foundation:"phase-6",database:pool?"configured":"not_configured"}));
app.get("/ready",async(_r,reply)=>{try{if(!pool)return reply.status(503).send({ready:false,reason:"DATABASE_URL missing"});await pool.query("SELECT 1");return {ready:true};}catch{return reply.status(503).send({ready:false,reason:"database unavailable"});}});
app.post("/v1/workflow/classify",async(request)=>{const body=request.body as {type:string;risk?:"low"|"medium"|"high"|"critical"};return classifyNode(body.type,body.risk??"low");});
app.post("/v1/decision/evaluate",async(request)=>decideNextAction(request.body as Parameters<typeof decideNextAction>[0]));
app.post("/v1/intelligence/analyze",async(request)=>{const body=request.body as {brief:string};if(!body?.brief?.trim())return {error:"brief required"};return analyzeCreativeBrief(body.brief);});
app.post("/v1/intelligence/context-optimize",async(request)=>{const body=request.body as {items:Parameters<typeof optimizeContext>[0];maxChars?:number};return optimizeContext(body.items??[],body.maxChars);});
app.post("/v1/memory",async(request,reply)=>{const body=request.body as Parameters<typeof saveMemory>[0];if(!body?.content?.trim())return reply.status(400).send({error:"content required"});return reply.status(201).send(await saveMemory(body));});
app.get("/v1/memory/search",async(request)=>{const q=(request.query as {q?:string;projectId?:string;limit?:string});if(!q.q)return {results:[]};return {results:await searchMemory(q.q,q.projectId,Math.min(50,Math.max(1,Number(q.limit)||10)),((request as any).user as AuthUser).global_role==="admin")};});
app.post("/v1/intelligence/query-log",async(request)=>logQuery(request.body as Parameters<typeof logQuery>[0]));
app.get("/v1/intelligence/cache/:key",async(request)=>cacheGet((request.params as {key:string}).key));
app.put("/v1/intelligence/cache/:key",async(request)=>{const body=request.body as {value:unknown;ttlSeconds?:number};return cacheSet((request.params as {key:string}).key,body.value,body.ttlSeconds);});
app.get("/v1/models/openrouter",async()=>getFreeModels());
app.get("/v1/models/openrouter/all",async()=>discoverOpenRouterModels());
app.post("/v1/models/route",async(request)=>{const body=request.body as {task?:string};const models=await getFreeModels();return {task:body.task??"llm",model:routeFreeLLM(models,(body.task??"llm") as any)??null,freeOnly:true};});
app.get("/v1/providers",async()=>listProviders());
app.post("/v1/providers",async(request,reply)=>{try{return reply.status(201).send(await upsertProvider(request.body as any))}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.post("/v1/providers/route",async(request)=>routeRequest(request.body as any));
app.post("/v1/providers/discovery-candidates",async(request)=>{const p=discoveryCandidate(request.body as any);registerDiscoveredProvider(p);return p});
app.get("/v1/providers/discovered",async()=>getDiscoveredProviders());
app.post("/v1/generation-jobs",async(request,reply)=>{const body=request.body as any;const route=await routeRequest({task:body.task,freeOnly:body.freeOnly??false,durationSeconds:body.durationSeconds,aspectRatio:body.aspectRatio,resolution:body.resolution,references:!!body.inputAssets?.length,audio:body.audio,format:body.format});if(!route.provider)return reply.status(422).send({error:route.blockedReason,route});const job=await createGenerationJob({...body,providerId:route.provider.id});return reply.status(201).send({job,route,approvalRequired:true})});
app.get("/v1/generation-jobs",async(request)=>{const q=request.query as {projectId?:string};return listGenerationJobs(q.projectId,(request as any).user as AuthUser)});
app.post("/v1/generation-jobs/:id/review",async(request,reply)=>{try{return await reviewGenerationJob((request.params as {id:string}).id,parseReview(request.body))}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.get("/v1/assets",async(request)=>{const q=request.query as {projectId?:string};return q.projectId?listProjectAssets(q.projectId):listProjectAssetsGlobal((request as any).user as AuthUser)});
app.post("/v1/assets/:id/review",async(request,reply)=>{try{return await reviewAsset((request.params as {id:string}).id,parseReview(request.body))}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.get("/v1/generation-jobs/:id",async(request)=>getGenerationJob((request.params as {id:string}).id));
app.post("/v1/generation-jobs/:id/transition",async(request,reply)=>{try{return await transitionGenerationJob((request.params as {id:string}).id,(request.body as any).status,(request.body as any).result,(request.body as any).error)}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.get("/v1/projects/:id/timeline",async(request)=>getTimeline((request.params as {id:string}).id));
app.post("/v1/projects/:id/timeline/tracks",async(request,reply)=>{const body=request.body as {name:string;kind:string;order?:number};if(!body?.name||!body.kind)return reply.status(400).send({error:"name and kind required"});return reply.status(201).send(await createTrack((request.params as {id:string}).id,body))});
app.patch("/v1/timeline/tracks/:id",async(request,reply)=>{const r=await updateTrack((request.params as {id:string}).id,request.body as any);if(!r)return reply.status(404).send({error:"Track not found"});return r});
app.post("/v1/timeline/tracks/:id/clips",async(request,reply)=>{try{return reply.status(201).send(await createClip((request.params as {id:string}).id,request.body as any))}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.patch("/v1/timeline/clips/:id",async(request,reply)=>{try{const r=await updateClip((request.params as {id:string}).id,request.body as any);if(!r)return reply.status(404).send({error:"Clip not found"});return r}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.delete("/v1/timeline/clips/:id",async(request,reply)=>{if(!await deleteClip((request.params as {id:string}).id))return reply.status(404).send({error:"Clip not found"});return {deleted:true}});
app.post("/v1/timeline/clips/:id/split",async(request,reply)=>{try{return await splitClip((request.params as {id:string}).id,(request.body as {offsetMs:number}).offsetMs)}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.post("/v1/timeline/clips/:id/trim",async(request,reply)=>{try{return await trimClip((request.params as {id:string}).id,(request.body as {startMs:number;endMs:number}).startMs,(request.body as {startMs:number;endMs:number}).endMs)}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.post("/v1/projects/:id/render-jobs",async(request,reply)=>{try{const body=request.body as {profile?:any;options?:Record<string,unknown>};return reply.status(201).send(await createRenderJobFromTimeline((request.params as {id:string}).id,body.profile,body.options))}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.post("/v1/render-jobs/:id/review",async(request,reply)=>{try{const b=request.body as {decision:"approve"|"reject";reviewer:string;notes?:string};if(!["approve","reject"].includes(b?.decision))return reply.status(400).send({error:"decision must be approve or reject"});return await reviewRenderJob((request.params as {id:string}).id,b.decision,b.reviewer,b.notes)}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.get("/v1/projects/:id/render-jobs",async(request)=>listRenderJobs((request.params as {id:string}).id));
app.get("/v1/render-jobs/:id",async(request)=>getRenderJob((request.params as {id:string}).id));

app.post("/v1/auth/bootstrap",async(request,reply)=>{try{const b=request.body as any;return reply.status(201).send(await bootstrapAdmin(b?.bootstrapKey,b?.email,b?.password,b?.displayName,request.headers["user-agent"],request.ip))}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.post("/v1/auth/register",async(request,reply)=>{try{const b=request.body as any;return reply.status(201).send(await registerUser(b?.email,b?.password,b?.displayName,request.headers["user-agent"],request.ip))}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.post("/v1/auth/login",async(request,reply)=>{try{const b=request.body as any;return await loginUser(b?.email,b?.password,request.headers["user-agent"],request.ip)}catch(e){return reply.status(401).send({error:"Invalid email or password"})}});
app.get("/v1/auth/me",async(request)=>({user:(request as any).user}));
app.post("/v1/auth/logout",async(request,reply)=>{const token=request.headers.authorization?.slice(7)??"";await revokeSession(token);return reply.code(204).send()});
app.post("/v1/projects/:id/transfer-owner",async(request,reply)=>{try{const user=(request as any).user as AuthUser;if(user.global_role!=="admin")return reply.code(403).send({error:"Admin role required"});const p=request.params as any;const b=request.body as any;return await transferProjectOwnership(p.id,b?.userId,user.id)}catch(e){return reply.code(400).send({error:e instanceof Error?e.message:String(e)})}});
app.get("/v1/projects/:id/role",async(request,reply)=>{const id=(request.params as any).id;const user=(request as any).user as AuthUser;const role=await getProjectRole(user,id);if(!role)return reply.code(404).send({error:"Project not found"});return{role}});
app.get("/v1/projects/:id/members",async(request,reply)=>{const id=(request.params as any).id;const user=(request as any).user as AuthUser;const role=await getProjectRole(user,id);if(!role)return reply.code(404).send({error:"Project not found"});if(role!=="owner"&&user.global_role!=="admin")return reply.code(403).send({error:"Owner role required"});return listProjectMembers(id)});
app.post("/v1/projects/:id/members",async(request,reply)=>{try{const id=(request.params as any).id;const user=(request as any).user as AuthUser;const role=await getProjectRole(user,id);if(role!=="owner"&&user.global_role!=="admin")return reply.code(403).send({error:"Owner role required"});const b=request.body as any;if(!["editor","reviewer","viewer"].includes(b?.role))return reply.code(400).send({error:"Invalid member role"});return reply.status(201).send(await addProjectMember(id,b.email,b.role,user.id))}catch(e){return reply.code(400).send({error:e instanceof Error?e.message:String(e)})}});
app.delete("/v1/projects/:id/members/:userId",async(request,reply)=>{const p=request.params as any;const user=(request as any).user as AuthUser;const role=await getProjectRole(user,p.id);if(role!=="owner"&&user.global_role!=="admin")return reply.code(403).send({error:"Owner role required"});if(!await removeProjectMember(p.id,p.userId))return reply.code(404).send({error:"Member not found"});return{removed:true}});
app.get("/v1/projects",async(request)=>listProjects((request as any).user as AuthUser));
app.post("/v1/projects",async(request,reply)=>{const body=request.body as {title:string;mode?:string;target?:unknown;creativeBrief?:string};if(!body?.title?.trim())return reply.status(400).send({error:"title is required"});const user=(request as any).user as AuthUser;const created=await createProject(body,user.id);return reply.status(201).send(created);});
app.get("/v1/projects/:id",async(request,reply)=>{const {id}=request.params as {id:string};const p=await getProject(id);if(!p)return reply.status(404).send({error:"Project not found"});return p;});
app.patch("/v1/projects/:id",async(request,reply)=>{const {id}=request.params as {id:string};const p=await updateProject(id,request.body as Record<string,unknown>);if(!p)return reply.status(404).send({error:"Project not found"});return p;});
app.get("/v1/projects/:id/scenes",async(request)=>listScenes((request.params as {id:string}).id));
app.post("/v1/projects/:id/scenes",async(request,reply)=>{const {id}=request.params as {id:string};if(!await getProject(id))return reply.status(404).send({error:"Project not found"});const body=request.body as {title:string;prompt?:string;durationSeconds?:number;sceneOrder?:number};if(!body?.title?.trim())return reply.status(400).send({error:"title is required"});return reply.status(201).send(await createScene(id,body));});
app.patch("/v1/scenes/:id",async(request,reply)=>{const s=await updateScene((request.params as {id:string}).id,request.body as Record<string,unknown>);if(!s)return reply.status(404).send({error:"Scene not found"});return s;});
app.delete("/v1/scenes/:id",async(request,reply)=>{if(!await deleteScene((request.params as {id:string}).id))return reply.status(404).send({error:"Scene not found"});return {deleted:true};});
app.get("/v1/projects/:id/flow/characters",async(request)=>listCharacters((request.params as {id:string}).id));
app.post("/v1/projects/:id/flow/characters",async(request,reply)=>{const id=(request.params as {id:string}).id;if(!await getProject(id))return reply.status(404).send({error:"Project not found"});const body=request.body as {name:string;description?:string;consistencyNotes?:string;attributes?:Record<string,string>;referenceIds?:string[]};if(!body?.name?.trim())return reply.status(400).send({error:"name required"});return reply.status(201).send(await createCharacter(id,body));});
app.get("/v1/projects/:id/flow/references",async(request)=>listReferences((request.params as {id:string}).id));
app.post("/v1/projects/:id/flow/references",async(request,reply)=>{const id=(request.params as {id:string}).id;if(!await getProject(id))return reply.status(404).send({error:"Project not found"});const body=request.body as {kind:string;uri:string;label:string;tags?:string[];metadata?:unknown};if(!body?.uri||!body?.label)return reply.status(400).send({error:"uri and label required"});return reply.status(201).send(await createReference(id,body));});
app.post("/v1/projects/:id/flow/scenes/reorder",async(request,reply)=>{const id=(request.params as {id:string}).id;const body=request.body as {scenes:any[]};if(!Array.isArray(body?.scenes))return reply.status(400).send({error:"scenes array required"});return reply.send(await replaceFlowScenes(id,body.scenes));});
app.get("/v1/projects/:id/flow/production-graph",async(request)=>{const scenes=await listFlowScenes((request.params as {id:string}).id);return buildProductionGraph(scenes.map(s=>s.metadata?.id?s.metadata:{id:s.id,order:s.scene_order,title:s.title,prompt:s.prompt,durationSeconds:s.duration_seconds,status:s.status,characters:[],locations:[],props:[],referenceIds:[],camera:"",lighting:"",composition:"",action:"",dialogue:"",logline:"",version:1,continuityNotes:[]}));});
app.get("/v1/projects/:id/flow/continuity",async(request)=>{const scenes=await listFlowScenes((request.params as {id:string}).id);return continuityChecklist(scenes.map(s=>s.metadata?.id?s.metadata:{id:s.id,order:s.scene_order,title:s.title,prompt:s.prompt,durationSeconds:s.duration_seconds,status:s.status,characters:[],locations:[],props:[],referenceIds:[],camera:"",lighting:"",composition:"",action:"",dialogue:"",logline:"",version:1,continuityNotes:[]}));});
app.post("/v1/workflows",async(request,reply)=>{const body=request.body as {projectId?:string|null;name:string;graph:unknown};if(!body?.name||!body.graph)return reply.status(400).send({error:"name and graph required"});return reply.status(201).send(await createRun(body.projectId??null,body.name,body.graph));});
app.post("/v1/workflows/:id/transition",async(request,reply)=>{try{return await transitionRun((request.params as {id:string}).id,(request.body as {status:string}).status as Parameters<typeof transitionRun>[1]);}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:"transition failed"});}});
app.post("/v1/workflows/:id/checkpoints",async(request,reply)=>{const body=request.body as {nodeId:string;payload:unknown};if(!body?.nodeId)return reply.status(400).send({error:"nodeId required"});return reply.status(201).send(await saveCheckpoint((request.params as {id:string}).id,body.nodeId,body.payload??{}));});
app.get("/v1/workflows/:id/events",async(request)=>{return (await requireDb().query("SELECT * FROM workflow_events WHERE run_id=$1 ORDER BY id",[(request.params as {id:string}).id])).rows;});
app.get("/v1/workflows/:id/checkpoints",async(request)=>{return (await requireDb().query("SELECT * FROM checkpoints WHERE run_id=$1 ORDER BY created_at DESC",[(request.params as {id:string}).id])).rows;});
app.post('/v1/projects/:id/creative-plans',async(request,reply)=>{try{return reply.status(201).send(await createPlan((request.params as {id:string}).id,request.body as any))}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.get('/v1/projects/:id/creative-plans',async(request)=>listPlans((request.params as {id:string}).id));
app.get('/v1/projects/:id/creative-plans/:planId',async(request,reply)=>{const p=await getPlan((request.params as {id:string;planId:string}).id,(request.params as {planId:string}).planId);if(!p)return reply.status(404).send({error:'Plan not found'});return p});
app.patch('/v1/projects/:id/creative-plans/:planId',async(request,reply)=>{try{const p=await updatePlan((request.params as {id:string;planId:string}).id,(request.params as {planId:string}).planId,request.body as any);if(!p)return reply.status(404).send({error:'Plan not found'});return p}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.post('/v1/projects/:id/creative-plans/:planId/approve',async(request,reply)=>{try{return await approvePlan((request.params as {id:string;planId:string}).id,(request.params as {planId:string}).planId,(request.body as {reviewer:string}).reviewer)}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.post('/v1/projects/:id/creative-plans/:planId/script-packages',async(request,reply)=>{try{return reply.status(201).send(await enrichCreativePlan((request.params as {id:string;planId:string}).id,(request.params as {planId:string}).planId,request.body as any))}catch(e){return reply.status(422).send({error:e instanceof Error?e.message:String(e)})}});
app.get('/v1/projects/:id/script-packages',async(request)=>{const q=request.query as {planId?:string};return listScriptPackages((request.params as {id:string}).id,q.planId)});
app.get('/v1/projects/:id/script-packages/:packageId',async(request,reply)=>{const p=await getScriptPackage((request.params as {id:string;packageId:string}).id,(request.params as {packageId:string}).packageId);if(!p)return reply.status(404).send({error:'Package not found'});return p});
app.post('/v1/projects/:id/script-packages/:packageId/review',async(request,reply)=>{try{const b=request.body as {decision:'approve'|'reject';reviewer:string;notes?:string};if(!['approve','reject'].includes(b?.decision))return reply.status(400).send({error:'decision must be approve or reject'});return await reviewScriptPackage((request.params as {id:string;packageId:string}).id,(request.params as {packageId:string}).packageId,b.decision,b.reviewer,b.notes)}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.post('/v1/projects/:id/assets/:assetId/analyze',async(request,reply)=>{try{return reply.status(202).send(await requestAssetAnalysis((request.params as {id:string;assetId:string}).id,(request.params as {assetId:string}).assetId,(request.body as any)?.kinds))}catch(e){return reply.status(400).send({error:e instanceof Error?e.message:String(e)})}});
app.get('/v1/projects/:id/asset-analysis',async(request)=>{const q=request.query as {assetId?:string};return listAssetAnalysis((request.params as {id:string}).id,q.assetId)});
app.get('/v1/projects/:id/asset-analysis/:jobId',async(request,reply)=>{const j=await getAssetAnalysis((request.params as {id:string;jobId:string}).id,(request.params as {jobId:string}).jobId);if(!j)return reply.status(404).send({error:'Analysis job not found'});return j});
app.get('/v1/projects/:id/assets/:assetId/intelligence',async(request,reply)=>{try{return await getAssetIntelligence((request.params as {id:string;assetId:string}).id,(request.params as {assetId:string}).assetId)}catch(e){return reply.status(404).send({error:e instanceof Error?e.message:String(e)})}});
app.get('/v1/projects/:id/assets/:assetId/keyframes',async(request)=>listKeyframes((request.params as {id:string;assetId:string}).id,(request.params as {assetId:string}).assetId));
app.get('/v1/projects/:id/media-search',async(request)=>{const q=request.query as {q?:string;limit?:string};return searchMediaChunks((request.params as {id:string}).id,q.q??'',Number(q.limit)||10)});
const port=Number(process.env.PORT??3000);await app.listen({port,host:"0.0.0.0"});
