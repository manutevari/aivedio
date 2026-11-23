export type SecurityEnvironment=Record<string,string|undefined>;
export interface ApiSecurityConfig{allowedOrigins:string[];production:boolean;sessionSecret:string|undefined;}
function parseOrigins(raw:string):string[]{
 const origins=raw.split(",").map(x=>x.trim()).filter(Boolean);
 if(origins.some(x=>x==="*"||x.includes("*")))throw new Error("Wildcard CORS origins are not allowed");
 for(const origin of origins){
  let parsed:URL;
  try{parsed=new URL(origin)}catch{throw new Error("Invalid CORS origin: "+origin)}
  if(!["http:","https:"].includes(parsed.protocol)||parsed.origin!==origin.replace(/\/$/,""))
   throw new Error("CORS entries must be exact origins (scheme + host + optional port), not paths: "+origin);
 }
 return [...new Set(origins)];
}
export function loadApiSecurityConfig(env:SecurityEnvironment):ApiSecurityConfig{
 const production=env.NODE_ENV==="production";
 const sessionSecret=env.AIVEDIO_SESSION_SECRET?.trim()||undefined;
 if(production){
  if(!sessionSecret||sessionSecret.length<32)throw new Error("AIVEDIO_SESSION_SECRET must be at least 32 characters in production");
  const raw=env.AIVEDIO_ALLOWED_ORIGINS?.trim();
  if(!raw)throw new Error("AIVEDIO_ALLOWED_ORIGINS must be explicitly configured in production");
  const allowedOrigins=parseOrigins(raw);
  if(allowedOrigins.some(origin=>/localhost|127\.0\.0\.1|\[::1\]/i.test(origin)))throw new Error("Localhost origins are not permitted in production");
  return{allowedOrigins,production,sessionSecret};
 }
 return{allowedOrigins:parseOrigins(env.AIVEDIO_ALLOWED_ORIGINS??"http://localhost:5173,http://localhost:8501"),production,sessionSecret};
}
