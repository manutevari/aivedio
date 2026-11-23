import {requireDb} from "./db.js";

type Json=Record<string,unknown>;
const apiKey=()=>process.env.OPENROUTER_API_KEY?.trim();
const model=()=>process.env.OPENROUTER_AGENT_MODEL?.trim()||"openrouter/auto";
async function askAgent(role:string,system:string,input:unknown){
 const key=apiKey();if(!key)throw new Error("OPENROUTER_API_KEY is not configured on the AIVEDIO API server");
 const res=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json","HTTP-Referer":process.env.AIVEDIO_SITE_URL||"https://aivedio.local","X-Title":"AIVEDIO "+role},body:JSON.stringify({model:model(),temperature:0.2,response_format:{type:"json_object"},messages:[{role:"system",content:system},{role:"user",content:JSON.stringify(input)}]}),signal:AbortSignal.timeout(60000)});
 if(!res.ok)throw new Error(role+" model request failed ("+res.status+")");
 const data:any=await res.json();const content=data?.choices?.[0]?.message?.content;if(typeof content!=="string"||!content.trim())throw new Error(role+" returned an empty response");
 try{return JSON.parse(content)}catch{throw new Error(role+" returned invalid JSON")}
}
function normalizeBrief(value:unknown){return typeof value==="string"?value.slice(0,20000):""}
export async function runAgentPipeline(projectId:string,userId:string,input:Json){
 const project=(await requireDb().query("SELECT id,title,creative_brief,mode,target FROM projects WHERE id=$1",[projectId])).rows[0];if(!project)throw new Error("Project not found");
 const brief=normalizeBrief(input.brief)||normalizeBrief(project.creative_brief);
 if(!brief.trim())throw new Error("Provide a creative brief or update the project brief first");
 const context={projectTitle:project.title,projectMode:project.mode,target:project.target,brief,requestedOutcome:String(input.requestedOutcome??"Improve production readiness and quality").slice(0,4000),constraints:Array.isArray(input.constraints)?input.constraints.slice(0,50).map(x=>String(x).slice(0,1000)):[],humanApprovalRequired:true};
 const improvisor=await askAgent("Improvisor","You are AIVEDIO Improvisor: generate useful, grounded creative and production improvements. Return JSON {ideas:[{title,description,impact,risks}],recommendedDirection,assumptions}. Never claim facts unsupported by input.",context);
 const implementation=await askAgent("Implementation Agent","You are AIVEDIO Implementation Agent. Convert the approved direction into a practical staged plan. Return JSON {steps:[{id,title,description,ownerRole,dependencies,acceptanceCriteria}],requirements,risks,rollback}. Avoid actions requiring external credentials or irreversible operations.",{context,improvisor});
 const patch=await askAgent("Patcher","You are AIVEDIO Patcher. Produce a minimal revised creative brief, not code or executable instructions. Preserve user intent and explicit constraints. Return JSON {target:'projects.creative_brief',before,after,summary,changeSet:[{type:'replace',description}],reversible:true}. 'after' must be a string and must never exceed 20000 characters.",{context,improvisor,implementation});
 if(patch.target!=="projects.creative_brief"||typeof patch.after!=="string"||patch.after.length>20000)throw new Error("Patcher output failed target/schema validation");
 patch.before=brief;
 const audit=await askAgent("Auditor","You are a strict independent auditor. Independently inspect the brief patch AND implementation plan, including the proposed change set. Return JSON {verdict:'pass'|'needs_changes'|'fail',score:0-100,findings:[{severity:'critical'|'high'|'medium'|'low',finding,evidence,recommendation}],requiredHumanChecks,summary}. Never rubber-stamp. If proposal is vague, unsafe, unsupported or has critical issues, fail it.",{context,improvisor,implementation,patch});
 if(!["pass","needs_changes","fail"].includes(audit.verdict)||!Number.isFinite(audit.score)||audit.score<0||audit.score>100||!Array.isArray(audit.findings))throw new Error("Auditor output failed schema validation");
 if(audit.findings.some((f:any)=>!["critical","high","medium","low"].includes(f.severity)))throw new Error("Auditor finding severity is invalid");
 const client=await requireDb().connect();let row:any;
 try{await client.query("BEGIN");await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[projectId]);row=(await client.query("INSERT INTO agent_pipeline_runs(project_id,created_by,input,improvisor,implementation_plan,audit,patch,status) VALUES($1,$2,$3,$4,$5,$6,$7,'awaiting_approval') RETURNING *",[projectId,userId,context,improvisor,implementation,audit,patch])).rows[0];await client.query("COMMIT")}catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
 return row;
}
export async function listAgentRuns(projectId:string){return(await requireDb().query("SELECT id,status,input,improvisor,implementation_plan,audit,patch,human_decision,human_notes,decided_at,applied_at,created_at,updated_at FROM agent_pipeline_runs WHERE project_id=$1 ORDER BY created_at DESC",[projectId])).rows}
export async function getAgentRun(projectId:string,runId:string){return(await requireDb().query("SELECT * FROM agent_pipeline_runs WHERE project_id=$1 AND id=$2",[projectId,runId])).rows[0]??null}
export async function decideAgentRun(projectId:string,runId:string,userId:string,decision:"approve"|"reject",notes=""){
 const r=await requireDb().query("UPDATE agent_pipeline_runs SET status=$3,human_decision=$4,human_notes=$5,decided_by=$6,decided_at=now(),updated_at=now() WHERE project_id=$1 AND id=$2 AND status='awaiting_approval' AND NOT ($3='approved' AND (audit->>'verdict'='fail' OR COALESCE((audit->>'score')::int,0)<60 OR EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(audit->'findings','[]'::jsonb)) f WHERE f->>'severity'='critical'))) RETURNING *",[projectId,runId,decision==="approve"?"approved":"rejected",decision,notes.slice(0,4000),userId]);
 if(!r.rowCount)throw new Error("Agent run is not awaiting approval or auditor marked it unsafe for approval");
 return r.rows[0];
}
export async function applyApprovedBriefPatch(projectId:string,runId:string,userId:string){
 const client=await requireDb().connect();
 try{await client.query("BEGIN");await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[projectId]);const run=(await client.query("SELECT * FROM agent_pipeline_runs WHERE project_id=$1 AND id=$2 FOR UPDATE",[projectId,runId])).rows[0];if(!run)throw new Error("Agent run not found");if(run.status!=="approved"||run.human_decision!=="approve")throw new Error("Human approval is required before applying a patch");if(run.audit?.verdict==="fail"||Number(run.audit?.score)<60||run.audit?.findings?.some((f:any)=>f.severity==="critical"))throw new Error("Auditor gate blocks patch application");if(run.applied_at)throw new Error("Patch was already applied");
 const patch=run.patch as any;const before=normalizeBrief(patch.before),after=normalizeBrief(patch.after);if(patch.target!=="projects.creative_brief"||!after)throw new Error("Patch target or content is invalid");
 const updated=await client.query("UPDATE projects SET creative_brief=$2 WHERE id=$1 AND creative_brief IS NOT DISTINCT FROM $3 RETURNING id",[projectId,after,before]);if(!updated.rowCount)throw new Error("Project brief changed since this patch was generated; rerun the agent pipeline");
 await client.query("UPDATE agent_pipeline_runs SET status='applied',applied_at=now(),updated_at=now() WHERE id=$1",[runId]);
 await client.query("INSERT INTO project_memory(project_id,kind,content,tags,importance) VALUES($1,'agent_patch',$2,$3,0.8)",[projectId,JSON.stringify({runId,target:patch.target,before,after,summary:patch.summary,appliedBy:userId}),["agent","patch","hitl"]]);
 await client.query("COMMIT");return{runId,status:"applied",target:patch.target,summary:patch.summary};
 }catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
}

