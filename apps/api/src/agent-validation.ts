export type AgentRole="Improvisor"|"Implementation Agent"|"Patcher"|"Auditor";
export type JsonObject=Record<string,unknown>;
const isObject=(v:unknown):v is JsonObject=>!!v&&typeof v==="object"&&!Array.isArray(v);
const isString=(v:unknown)=>typeof v==="string";
const isArray=(v:unknown)=>Array.isArray(v);
const fail=(role:string,detail:string):never=>{throw new Error(role+" output failed schema validation: "+detail)};
export function parseAgentJson(role:AgentRole,raw:string):JsonObject{
 let text=raw.trim();
 if(text.startsWith("```"))text=text.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"").trim();
 let value:unknown;try{value=JSON.parse(text)}catch{fail(role,"invalid JSON")}
 if(!isObject(value))fail(role,"expected an object");
 if(role==="Improvisor"){
  if(!isArray(value.ideas)||!isString(value.recommendedDirection)||!isArray(value.assumptions))fail(role,"expected ideas[], recommendedDirection, assumptions[]");
  for(const idea of value.ideas){if(!isObject(idea)||!isString(idea.title)||!isString(idea.description)||!isString(idea.impact)||!isArray(idea.risks))fail(role,"invalid idea item")}
 }
 if(role==="Implementation Agent"){
  if(!isArray(value.steps)||!isArray(value.requirements)||!isArray(value.risks)||!isString(value.rollback))fail(role,"expected steps[], requirements[], risks[], rollback");
  for(const step of value.steps){if(!isObject(step)||!isString(step.id)||!isString(step.title)||!isString(step.description)||!isString(step.ownerRole)||!isArray(step.dependencies)||!isArray(step.acceptanceCriteria))fail(role,"invalid implementation step")}
 }
 if(role==="Patcher"){
  if(value.target!=="projects.creative_brief"||!isString(value.before)||!isString(value.after)||value.after.length>20000||!isString(value.summary)||!isArray(value.changeSet)||value.reversible!==true)fail(role,"invalid patch schema or target");
 }
 if(role==="Auditor"){
  if(!["pass","needs_changes","fail"].includes(String(value.verdict))||!Number.isInteger(value.score)||Number(value.score)<0||Number(value.score)>100||!isArray(value.findings)||!isArray(value.requiredHumanChecks)||!isString(value.summary))fail(role,"invalid verdict, score, findings, checks, or summary");
  for(const finding of value.findings){if(!isObject(finding)||!["critical","high","medium","low"].includes(String(finding.severity))||!isString(finding.finding)||!isString(finding.evidence)||!isString(finding.recommendation))fail(role,"invalid finding")}
 }
 return value;
}
