import {createHmac,randomBytes,timingSafeEqual,scrypt as scryptCallback} from "node:crypto";
import {promisify} from "node:util";
import {requireDb} from "./db.js";
const scrypt=promisify(scryptCallback);
function derive(password:string,salt:string|Buffer,keylen:number,options:{N:number;r:number;p:number;maxmem:number}){return new Promise<Buffer>((resolve,reject)=>scryptCallback(password,salt,keylen,options,(error,key)=>error?reject(error):resolve(key as Buffer)))}
const TTL_DAYS=14, N=32768,R=8,P=1;
export interface AuthUser{id:string;email:string;display_name:string;global_role:"admin"|"member";}
export interface AuthSession{token:string;expiresAt:string;user:AuthUser;}
const emailNorm=(s:string)=>s.trim().toLowerCase();
function validEmail(s:string){const e=emailNorm(s);if(e.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))throw new Error("Valid email required");return e}
function validPassword(s:string){if(s.length<12||s.length>128)throw new Error("Password must be 12–128 characters");return s}
async function hashPassword(p:string){const salt=randomBytes(16);const key=await derive(p,salt,64,{N,r:R,p:P,maxmem:128*1024*1024});return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`}
async function verifyPassword(p:string,encoded:string){const [scheme,n,r,par,salt,key]=encoded.split("$");if(scheme!=="scrypt"||!n||!r||!par||!salt||!key)return false;try{const expected=Buffer.from(key,"base64url");const actual=await derive(p,Buffer.from(salt,"base64url"),expected.length,{N:Number(n),r:Number(r),p:Number(par),maxmem:128*1024*1024});return actual.length===expected.length&&timingSafeEqual(actual,expected)}catch{return false}}
function sessionDigest(token:string){const secret=process.env.AIVEDIO_SESSION_SECRET;if(!secret||secret.length<32)throw new Error("AIVEDIO_SESSION_SECRET must be at least 32 characters");return createHmac("sha256",secret).update(token).digest("hex")}
function userRow(r:any):AuthUser{return{id:r.id,email:r.email,display_name:r.display_name,global_role:r.global_role}}
export async function createUser(emailInput:string,passwordInput:string,displayName="",role:"admin"|"member"="member"){const email=validEmail(emailInput),password=validPassword(passwordInput),hash=await hashPassword(password);try{return userRow((await requireDb().query("INSERT INTO users(email,display_name,password_hash,global_role) VALUES($1,$2,$3,$4) RETURNING id,email,display_name,global_role",[email,String(displayName).trim().slice(0,120),hash,role])).rows[0])}catch(e:any){if(e?.code==="23505")throw new Error("Email already registered");throw e}}
export async function createSession(userId:string,userAgent?:string,ip?:string):Promise<AuthSession>{const token=randomBytes(32).toString("base64url"),expires=new Date(Date.now()+TTL_DAYS*86400000).toISOString();await requireDb().query("INSERT INTO user_sessions(user_id,token_hash,expires_at,user_agent,ip_address) VALUES($1,$2,$3,$4,$5)",[userId,sessionDigest(token),expires,userAgent?.slice(0,500)??null,ip??null]);const row=(await requireDb().query("SELECT id,email,display_name,global_role FROM users WHERE id=$1 AND disabled_at IS NULL",[userId])).rows[0];if(!row)throw new Error("Account unavailable");return{token,expiresAt:expires,user:userRow(row)}}
export async function loginUser(email:string,password:string,userAgent?:string,ip?:string){const e=validEmail(email),row=(await requireDb().query("SELECT id,email,display_name,global_role,password_hash FROM users WHERE lower(email)=$1 AND disabled_at IS NULL",[e])).rows[0];if(!row){await derive(password,"aivedio-login-dummy-salt",64,{N,r:R,p:P,maxmem:128*1024*1024});throw new Error("Invalid email or password")}if(!await verifyPassword(password,row.password_hash))throw new Error("Invalid email or password");return createSession(row.id,userAgent,ip)}
export async function registerUser(email:string,password:string,name:string,userAgent?:string,ip?:string){if(process.env.AIVEDIO_ALLOW_SELF_REGISTRATION!=="true")throw new Error("Registration is disabled. Contact your administrator.");const user=await createUser(email,password,name,"member");return createSession(user.id,userAgent,ip)}
export async function bootstrapAdmin(key:string,email:string,password:string,name:string,userAgent?:string,ip?:string){
 const configured=process.env.AIVEDIO_BOOTSTRAP_ADMIN_KEY;
 if(!configured||configured.length<32)throw new Error("Admin bootstrap is not configured");
 const a=Buffer.from(key??""),b=Buffer.from(configured);if(a.length!==b.length||!timingSafeEqual(a,b))throw new Error("Invalid bootstrap key");
 const client=await requireDb().connect();let user:AuthUser;
 try{await client.query("BEGIN");await client.query("SELECT pg_advisory_xact_lock(76542190)");
  const count=await client.query("SELECT count(*)::int n FROM users");if(count.rows[0].n!==0)throw new Error("Bootstrap is available only before the first account exists");
  const emailValue=validEmail(email),passwordValue=validPassword(password),hash=await hashPassword(passwordValue);
  const inserted=await client.query("INSERT INTO users(email,display_name,password_hash,global_role) VALUES($1,$2,$3,$4) RETURNING id,email,display_name,global_role",[emailValue,String(name||"").trim().slice(0,120),hash,"admin"]);
  user=userRow(inserted.rows[0]);await client.query("COMMIT");
 }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
 return createSession(user.id,userAgent,ip);
}
export async function authenticateSession(token:string){if(!token)return null;const r=await requireDb().query("SELECT u.id,u.email,u.display_name,u.global_role,s.id session_id FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.disabled_at IS NULL",[sessionDigest(token)]);if(!r.rowCount)return null;await requireDb().query("UPDATE user_sessions SET last_seen_at=now() WHERE id=$1",[r.rows[0].session_id]);return userRow(r.rows[0])}
export async function revokeSession(token:string){if(token)await requireDb().query("UPDATE user_sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL",[sessionDigest(token)])}
export async function getProjectRole(user:AuthUser,projectId:string){if(user.global_role==="admin")return"owner";const r=await requireDb().query("SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2",[projectId,user.id]);return r.rows[0]?.role??null}
export async function addProjectMember(projectId:string,email:string,role:"editor"|"reviewer"|"viewer",addedBy:string){const e=validEmail(email),u=(await requireDb().query("SELECT id,email,display_name FROM users WHERE lower(email)=$1 AND disabled_at IS NULL",[e])).rows[0];if(!u)throw new Error("Account not found");const r=await requireDb().query("INSERT INTO project_members(project_id,user_id,role,added_by) VALUES($1,$2,$3,$4) ON CONFLICT(project_id,user_id) DO UPDATE SET role=excluded.role RETURNING project_id,user_id,role",[projectId,u.id,role,addedBy]);return{...r.rows[0],email:u.email,display_name:u.display_name}}
export async function listProjectMembers(projectId:string){return(await requireDb().query("SELECT pm.user_id,pm.role,pm.created_at,u.email,u.display_name FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=$1 ORDER BY pm.role,u.email",[projectId])).rows}
export async function removeProjectMember(projectId:string,userId:string){const r=await requireDb().query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2 AND role<>'owner' RETURNING user_id",[projectId,userId]);return Boolean(r.rowCount)}
