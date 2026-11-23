import {requireDb} from "./db.js";
export async function createCharacter(projectId:string,input:{name:string;description?:string;consistencyNotes?:string;attributes?:Record<string,string>;referenceIds?:string[]}){return(await requireDb().query("INSERT INTO flow_characters(project_id,name,description,consistency_notes,attributes,reference_ids) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",[projectId,input.name,input.description??"",input.consistencyNotes??"",input.attributes??{},input.referenceIds??[]])).rows[0]}
export async function listCharacters(projectId:string){return(await requireDb().query("SELECT * FROM flow_characters WHERE project_id=$1 ORDER BY created_at",[projectId])).rows}
export async function createReference(projectId:string,input:{kind:string;uri:string;label:string;tags?:string[];metadata?:unknown}){return(await requireDb().query("INSERT INTO flow_references(project_id,kind,uri,label,tags,metadata) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",[projectId,input.kind,input.uri,input.label,input.tags??[],input.metadata??{}])).rows[0]}
export async function listReferences(projectId:string){return(await requireDb().query("SELECT * FROM flow_references WHERE project_id=$1 ORDER BY created_at DESC",[projectId])).rows}
export async function replaceFlowScenes(projectId:string,scenes:any[]){
 const db=requireDb(),client=await db.connect();
 try{
  await client.query("BEGIN");
  const ids=[...new Set(scenes.map((s:any)=>s?.id).filter((id:any)=>typeof id==="string"))];
  if(ids.length){
   const existing=await client.query("SELECT id,project_id FROM scenes WHERE id=ANY($1::uuid[]) FOR UPDATE",[ids]);
   if(existing.rows.some((r:any)=>r.project_id!==projectId))throw new Error("Scene not found in project");
  }
  for(const s of scenes){
   const result=await client.query("INSERT INTO scenes(id,project_id,scene_order,title,prompt,duration_seconds,status,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET scene_order=excluded.scene_order,title=excluded.title,prompt=excluded.prompt,duration_seconds=excluded.duration_seconds,status=excluded.status,metadata=excluded.metadata,updated_at=now() WHERE scenes.project_id=excluded.project_id RETURNING id",[s.id,projectId,s.order,s.title,s.prompt,s.durationSeconds,s.status,s]);
   if(!result.rowCount)throw new Error("Scene not found in project");
  }
  await client.query("COMMIT");
 }catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
 return listFlowScenes(projectId);
}
export async function listFlowScenes(projectId:string){return(await requireDb().query("SELECT * FROM scenes WHERE project_id=$1 ORDER BY scene_order",[projectId])).rows}
