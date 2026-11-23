import {createHash,createHmac,randomBytes,scrypt as scryptCallback,timingSafeEqual} from "node:crypto";
import {promisify} from "node:util";
import {requireDb} from "./db.js";

const scrypt=promisify(scryptCallback);
const SESSION_TTL_DAYS=14;
const SCRYPT_N=32768;
const SCRYPT_R=8;
const SCRYPT_P=1;

export interface AuthUser{id:string;email:string;display_name:string;global_role:"admin"|"member";}
export interface AuthSession{token:string;expiresAt:string;user:AuthUser;}
function normalizeEmail(value:string){return value.trim().toLowerCase();}
function validateEmail(value:string){const email=normalizeEmail(value);if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error("A valid email address is required");return email;}
function validatePassword(value:string){if(value.length<12||value.length>128)throw new Error("Password must be between 12 and 128 characters");return value;}
async function passwordHash(password:string){
 const salt=randomBytes(16);
 const derived=await scrypt(password,salt,64,{N:SCRYPT_N,r:SCRYPT_R,p:SCRYPT_P,maxmem:128*1024*1024}) as Buffer;
 return ["scrypt",SCRYPT_N,SCRYPT_R,SCRYPT_P,salt.toString("base64url"),derived.toString("base64url")].join("$");
}
async function passwordMatches(password:string,encoded:string){
 const [scheme,n,r,p,saltText,keyText]=encoded.split("$");
 if(scheme!=="scrypt"||!n||!r||!p||!saltText||!keyText)return false;
 const expected=Buffer.from(keyText,"base64url");
 try{
  const actual=await scrypt(password,Buffer.from(saltText,"base64url"),expected.length,{N:Number(n),r:Number(r),p:Number(p),maxmem:128*1024*1024}) as Buffer;
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
 }catch{return false}
}
function sessionHash(token:string){
 const secret=process.env.AIVEDIO_SESSION_SECRET;
 if(!secret||secret.length<32)throw new Error("AIVEDIO_SESSION_SECRET must be configured with at least 32 characters");
 return createHmac("sha256",secret).update(token).digest("hex");
}
function publicUser(row:any):AuthUser{return{id:row.id,email:row.email,display_name:row.display_name,global_role:row.global_role};}

export async function createUser(emailInput:string,passwordInput:string,displayName="",globalRole:"admin"|"member"="member"){
 const email=validateEmail(emailInput),password=validatePassword(passwordInput);
 const hash=await passwordHash(password);
 const name=String(displayName||"").trim().slice(0,120);
 try{
  const result=await requireDb().query(
   "INSERT INTO users(email,display_name,password_hash,global_role) VALUES($1,$2,$3,$4) RETURNING id,email,display_name,global_role",
   [email,name,hash,globalRole]
  );
  return publicUser(result.rows[0]);
 }catch(error:any){
  if(error?.code==="23505")throw new Error("An account with this email already exists");
  throw error;
 }
}
export async function createSession(userId:string,userAgent?:string,ipAddress?:string):Promise<AuthSession>{
 const token=randomBytes(32).toString("base64url");
 const expiresAt=new Date(Date.now()+SESSION_TTL_DAYS*24*60*60*1000).toISOString();
 await requireDb().query(
  "INSERT INTO user_sessions(user_id,token_hash,expires_at,user_agent,ip_address) VALUES($1,$2,$3,$4,$5)",
  [userId,sessionHash(token),expiresAt,userAgent?.slice(0,500)??null,ipAddress??null]
 );
 const user=(await requireDb().query("SELECT id,email,display_name,global_role FROM users WHERE id=$1 AND disabled_at IS NULL",[userId])).rows[0];
 if(!user)throw new Error("User is unavailable");
 return{token,expiresAt,user:publicUser(user)};
}
export async function registerUser(email:string,password:string,displayName:string,userAgent?:string,ipAddress?:string){
 if(process.env.AIVEDIO_ALLOW_SELF_REGISTRATION!=="true")throw new Error("Self-registration is disabled. Contact the AIVEDIO administrator.");
 const user=await createUser(email,password,displayName,"member");
 const session=await createSession(user.id,userAgent,ipAddress);
 return session;
}
export async function loginUser(emailInput:string,password:string,userAgent?:string,ipAddress?:string){
 const email=validateEmail(emailInput);
 const row=(await requireDb().query("SELECT id,email,display_name,global_role,password_hash FROM users WHERE lower(email)=$1 AND disabled_at IS NULL",[email])).rows[0];
 // Run a dummy derivation for unknown accounts to reduce email-enumeration timing differences.
 const hash=row?.password_hash??"scrypt$32768$8$1$MDAwMDAwMDAwMDAwMDAwMA$MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwD6ZRb22q
})();
 
export async function authenticateSession(token:string){
 if(!token)return null;
 const hash=sessionHash(token);
 const r=await requireDb().query(
  "SELECT u.id,u.email,u.display_name,u.global_role,s.id session_id FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.disabled_at IS NULL",
  [hash]
 );
 if(!r.rowCount)return null;
 await requireDb().query("UPDATE user_sessions SET last_seen_at=now() WHERE id=$1",[r.rows[0].session_id]);
 return publicUser(r.rows[0]);
}
export async function revokeSession(token:string){
 if(!token)return;
 await requireDb().query("UPDATE user_sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL",[sessionHash(token)]);
}
export async function getProjectRole(user:AuthUser,projectId:string):Promise<string|null>{
 if(user.global_role==="admin")return"owner";
 const r=await requireDb().query("SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2",[projectId,user.id]);
 return r.rows[0]?.role??null;
}
export async function addProjectMember(projectId:string,emailInput:string,role:"editor"|"reviewer"|"viewer",addedBy:string){
 const email=validateEmail(emailInput);
 const user=(await requireDb().query("SELECT id,email,display_name FROM users WHERE lower(email)=$1 AND disabled_at IS NULL",[email])).rows[0];
 if(!user)throw new Error("No active AIVEDIO account exists for that email");
 const r=await requireDb().query(
  "INSERT INTO project_members(project_id,user_id,role,added_by) VALUES($1,$2,$3,$4) ON CONFLICT(project_id,user_id) DO UPDATE SET role=excluded.role RETURNING project_id,user_id,role",
  [projectId,user.id,role,addedBy]
 );
 return{...r.rows[0],email:user.email,display_name:user.display_name};
}
export async function listProjectMembers(projectId:string){
 return(await requireDb().query("SELECT pm.user_id,pm.role,pm.created_at,u.email,u.display_name FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=$1 ORDER BY CASE pm.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 WHEN 'reviewer' THEN 2 ELSE 3 END,u.email",[projectId])).rows;
}
export async function removeProjectMember(projectId:string,userId:string){
 const r=await requireDb().query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2 AND role<>'owner' RETURNING user_id",[projectId,userId]);
 return Boolean(r.rowCount);
}
