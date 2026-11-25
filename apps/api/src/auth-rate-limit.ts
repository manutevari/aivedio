export interface RateLimitDecision{allowed:boolean;remaining:number;retryAfterMs:number}
export class AuthRateLimiter{
 private buckets=new Map<string,{count:number;resetAt:number}>();
 constructor(private readonly maxBuckets=10000){}
 allow(key:string,limit:number,windowMs:number,now=Date.now()):RateLimitDecision{
  for(const [k,v] of this.buckets)if(v.resetAt<=now)this.buckets.delete(k);
  let current=this.buckets.get(key);
  if(!current||current.resetAt<=now){if(this.buckets.size>=this.maxBuckets){const oldest=this.buckets.keys().next().value;if(oldest)this.buckets.delete(oldest)}current={count:0,resetAt:now+windowMs};this.buckets.set(key,current)}
  if(current.count>=limit)return{allowed:false,remaining:0,retryAfterMs:Math.max(0,current.resetAt-now)};
  current.count++;return{allowed:true,remaining:Math.max(0,limit-current.count),retryAfterMs:0}
 }
}

import {requireDb} from "./db.js";

/** Shared, atomic rate limiting across API replicas using PostgreSQL. Fails closed on database errors. */
export async function allowAuthAttempt(key:string,limit:number,windowMs:number):Promise<RateLimitDecision>{
 if(!key||key.length>512||!Number.isInteger(limit)||limit<1||!Number.isFinite(windowMs)||windowMs<1)throw new Error("Invalid authentication rate-limit parameters");
 const db=requireDb();
 await db.query("WITH stale AS (SELECT bucket_key FROM auth_rate_limit_buckets WHERE reset_at<now()-interval '1 day' ORDER BY reset_at LIMIT 100) DELETE FROM auth_rate_limit_buckets b USING stale WHERE b.bucket_key=stale.bucket_key");
 const r=await db.query(
  "INSERT INTO auth_rate_limit_buckets(bucket_key,attempt_count,reset_at) VALUES($1,1,now()+($3::double precision*interval '1 millisecond')) ON CONFLICT(bucket_key) DO UPDATE SET attempt_count=CASE WHEN auth_rate_limit_buckets.reset_at<=now() THEN 1 ELSE auth_rate_limit_buckets.attempt_count+1 END,reset_at=CASE WHEN auth_rate_limit_buckets.reset_at<=now() THEN now()+($3::double precision*interval '1 millisecond') ELSE auth_rate_limit_buckets.reset_at END,updated_at=now() RETURNING attempt_count,reset_at",
  [key,limit,windowMs]
 );
 const row=r.rows[0];const retryAfterMs=Math.max(0,new Date(row.reset_at).getTime()-Date.now());
 return{allowed:Number(row.attempt_count)<=limit,remaining:Math.max(0,limit-Number(row.attempt_count)),retryAfterMs};
}
