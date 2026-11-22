export interface CreativeProject {
 id:string; title:string; mode:"simple"|"flow"|"pro"|"studio";
 target:{aspectRatio:string;resolution:string;fps:number;durationSeconds?:number};
 status:"draft"|"planning"|"producing"|"review"|"rendering"|"completed"|"failed";
 creativeBrief?:string; sentiment?:string; createdAt:string; updatedAt:string;
}
export interface Scene {
 id:string; projectId:string; order:number; title:string; prompt:string; durationSeconds:number;
 status:"planned"|"generating"|"generated"|"qa"|"approved"|"failed"; referenceAssetIds:string[];
 selectedModels:Record<string,string|"auto">; continuityNotes?:string; camera?:string; lighting?:string; audioPlan?:string; artifactIds:string[];
}
