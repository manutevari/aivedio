export type SecurityEnvironment=Record<string,string|undefined>;
export interface ApiSecurityConfig{apiToken:string|undefined;allowedOrigins:string[];production:boolean;}
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
 const apiToken=env.AIVEDIO_API_TOKEN?.trim()||undefined;
 if(production){
  if(!apiToken)throw new Error("AIVEDIO_API_TOKEN must be configured in production");
  if(apiToken.length<32)throw new Error("AIVEDIO_API_TOKEN must be at least 32 characters in production");
  const raw=env.AIVEDIO_ALLOWED_ORIGINS?.trim();
  if(!raw)throw new Error("AIVEDIO_ALLOWED_ORIGINS must be explicitly configured in production");
  const allowedOrigins=parseOrigins(raw);
  if(allowedOrigins.some(origin=>/localhost|127\.0\.0\.1|\[::1\]/i.test(origin)))throw new Error("Localhost origins are not permitted in production");
  return{apiToken,allowedOrigins,production};
 }
 return{apiToken,allowedOrigins:parseOrigins(env.AIVEDIO_ALLOWED_ORIGINS??"http://localhost:5173,http://localhost:8501"),production};
}
