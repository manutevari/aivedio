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
