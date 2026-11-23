import type { WorkerJob } from "@aivedio/core";
import {getAdapter,registeredAdapterIds} from "./adapters.js";
export interface ProviderRoute { selected:string; alternatives:string[]; reason:string; confidence:number; }
export function routeGenerationJob(job:WorkerJob):ProviderRoute{
 const available=registeredAdapterIds();
 const requested=getAdapter(job.providerId);
 if(requested)return{selected:requested.providerId,alternatives:available.filter(id=>id!==requested.providerId),reason:"Requested provider is registered and will be honored.",confidence:1};
 return{selected:"",alternatives:available,reason:"Requested provider is not registered. Router refuses silent provider substitution.",confidence:0};
}
export function assertRoute(job:WorkerJob):ProviderRoute{
 const route=routeGenerationJob(job);if(!route.selected)throw new Error("ROUTER_NO_PROVIDER: "+job.providerId+" is not registered. Available adapters: "+(route.alternatives.join(", ")||"none"));return route;
}
