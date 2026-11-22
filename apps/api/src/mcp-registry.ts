import {ProviderDescriptor} from "@aivedio/core";
const registry=new Map<string,ProviderDescriptor>();
export function registerDiscoveredProvider(provider:ProviderDescriptor){registry.set(provider.id,provider);return provider}
export function getDiscoveredProviders(){return [...registry.values()]}
export function clearDiscoveredProviders(){registry.clear()}
/** Discovery is deliberately separate from trust: discovered entries remain unverified until explicit validation. */
export function discoveryCandidate(input:{id:string;name:string;endpoint:string;capabilities:ProviderDescriptor["capabilities"]}):ProviderDescriptor{return{id:input.id,name:input.name,source:"mcp",endpoint:input.endpoint,capabilities:input.capabilities,authRequired:false,authConfigured:false,pricing:{free:false},trust:{verified:false,score:0,notes:["Discovered; not yet security-verified"]},availability:"unknown"}}
