import {WorkerJob} from "@aivedio/core";
export interface ProviderOutput{providerJobId:string;assets:Array<{kind:string;storageProvider:string;storageKey:string;mimeType:string;sizeBytes:number;checksum?:string;metadata?:Record<string,unknown>}>;metadata?:Record<string,unknown>}
export interface ProviderAdapter{readonly providerId:string;generate(job:WorkerJob):Promise<ProviderOutput>;cancel?(providerJobId:string):Promise<void>}
const adapters=new Map<string,ProviderAdapter>();
export function registerAdapter(adapter:ProviderAdapter){if(adapters.has(adapter.providerId))throw new Error("Adapter already registered: "+adapter.providerId);adapters.set(adapter.providerId,adapter)}
export function getAdapter(providerId:string){return adapters.get(providerId)}
export function registeredAdapterIds(){return [...adapters.keys()]}
/** No generic HTTP/MCP adapter is enabled: provider-specific code and credentials must be reviewed before registration. */
