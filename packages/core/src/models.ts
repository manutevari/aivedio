export type TaskKind="llm"|"image"|"video"|"music"|"voice"|"audio"|"editing"|"animation";
export interface ModelCapability { task:TaskKind; maxResolution?:string; maxDurationSeconds?:number; supportsReferenceImages?:boolean; supportsAudio?:boolean; supportsVideoInput?:boolean; contextWindow?:number; }
export interface ModelRecord { id:string; provider:string; displayName:string; capabilities:ModelCapability[]; pricing:{free:boolean;verifiedAt?:string}; availability:"available"|"limited"|"unavailable"|"unknown"; qualityScore?:number; }
export type ModelSelection = {mode:"auto";task:TaskKind;constraints?:Record<string,unknown>} | {mode:"manual";modelId:string;lock:boolean;task:TaskKind};
export function eligibleModels(models:ModelRecord[],task:TaskKind,freeOnly=true):ModelRecord[] {
  return models.filter(m=>m.availability==="available"&&m.capabilities.some(c=>c.task===task)&&(!freeOnly||m.pricing.free));
}
export function autoSelectModel(models:ModelRecord[],task:TaskKind,freeOnly=true):ModelRecord|undefined {
  return eligibleModels(models,task,freeOnly).sort((a,b)=>(b.qualityScore??0)-(a.qualityScore??0))[0];
}
