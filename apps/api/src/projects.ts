import {requireDb} from "./db.js";
import type {AuthUser} from "./auth.js";
export async function listProjects(user:AuthUser){if(user.global_role==="admin")return(await requireDb().query("SELECT * FROM projects ORDER BY updated_at DESC")).rows;return(await requireDb().query("SELECT p.* FROM projects p JOIN project_members pm ON pm.project_id=p.id WHERE pm.user_id=$1 ORDER BY p.updated_at DESC",[user.id])).rows;}
export async function createProject(input:{title:string;mode?:string;target?:unknown;creativeBrief?:string},ownerId?:string){
 if(!ownerId)return(await requireDb().query("INSERT INTO projects(title,mode,target,creative_brief) VALUES($1,$2,$3,$4) RETURNING *",[input.title,input.mode??"flow",input.target??{},input.creativeBrief??null])).rows[0];
 const client=await requireDb().connect();
 try{await client.query("BEGIN");const project=(await client.query("INSERT INTO projects(title,mode,target,creative_brief,owner_user_id) VALUES($1,$2,$3,$4,$5) RETURNING *",[input.title,input.mode??"flow",input.target??{},input.creativeBrief??null,ownerId])).rows[0];await client.query("INSERT INTO project_members(project_id,user_id,role) VALUES($1,$2,$3)",[project.id,ownerId,"owner"]);await client.query("COMMIT");return project}catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
}
export async function getProject(id:string){return (await requireDb()!.query("SELECT * FROM projects WHERE id=$1",[id])).rows[0]??null;}
export async function updateProject(id:string,input:Record<string,unknown>){
 const r=await requireDb()!.query("UPDATE projects SET title=COALESCE($2,title),mode=COALESCE($3,mode),creative_brief=COALESCE($4,creative_brief),target=COALESCE($5,target),updated_at=now() WHERE id=$1 RETURNING *",[id,input.title??null,input.mode??null,input.creativeBrief??null,input.target??null]);return r.rows[0]??null;
}
export async function listScenes(projectId:string){return (await requireDb()!.query("SELECT * FROM scenes WHERE project_id=$1 ORDER BY scene_order",[projectId])).rows;}
export async function createScene(projectId:string,input:{title:string;prompt?:string;durationSeconds?:number;sceneOrder?:number}){
 return (await requireDb()!.query("INSERT INTO scenes(project_id,scene_order,title,prompt,duration_seconds) VALUES($1,$2,$3,$4,$5) RETURNING *",[projectId,input.sceneOrder??0,input.title,input.prompt??"",input.durationSeconds??10])).rows[0];
}
export async function updateScene(id:string,input:Record<string,unknown>){
 return (await requireDb()!.query("UPDATE scenes SET title=COALESCE($2,title),prompt=COALESCE($3,prompt),duration_seconds=COALESCE($4,duration_seconds),status=COALESCE($5,status),metadata=COALESCE($6,metadata),updated_at=now() WHERE id=$1 RETURNING *",[id,input.title??null,input.prompt??null,input.durationSeconds??null,input.status??null,input.metadata??null])).rows[0]??null;
}
export async function deleteScene(id:string){const db=requireDb() as any;const result=await db.query("DELETE FROM scenes WHERE id=$1 RETURNING id",[id]);return Number(result?.rowCount??0)>0;}
