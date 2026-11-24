export type AgentRole="Researcher"|"Script Agent"|"Narrator Agent"|"Voice Modulator Agent"|"Improvisor"|"Implementation Agent"|"Patcher"|"Auditor";
export type JsonObject=Record<string,unknown>;
const isObject=(v:unknown):v is JsonObject=>!!v&&typeof v==="object"&&!Array.isArray(v);
const isString=(v:unknown):v is string=>typeof v==="string";
const isArray=(v:unknown):v is unknown[]=>Array.isArray(v);
const fail=(role:string,detail:string):never=>{throw new Error(role+" output failed schema validation: "+detail)};
export function parseAgentJson(role:AgentRole,raw:string):JsonObject{
 let text=raw.trim();
 const fence=String.fromCharCode(96).repeat(3);
 if(text.startsWith(fence))text=text.slice(fence.length).replace(/^json\s*/i,"").split(fence)[0]??"";
 let parsed:unknown;try{parsed=JSON.parse(text)}catch{fail(role,"invalid JSON")}
 if(!isObject(parsed))fail(role,"expected an object");
 const value=parsed as JsonObject;
 if(role==="Researcher"){
  if(!isString(value.summary)||!isArray(value.findings)||!isArray(value.gaps)||!isArray(value.recommendedQueries))fail(role,"expected summary, findings[], gaps[], recommendedQueries[]");
  for(const finding of value.findings as unknown[]){if(!isObject(finding)||!isString(finding.claim)||!isString(finding.evidence)||!isArray(finding.sourceIds)||!["high","medium","low"].includes(String(finding.confidence))||(finding.sourceIds as unknown[]).some(id=>!isString(id)))fail(role,"invalid research finding")}
  if((value.gaps as unknown[]).some(x=>!isString(x))||(value.recommendedQueries as unknown[]).some(x=>!isString(x)))fail(role,"gaps and recommendedQueries must contain strings");
 }
 if(role==="Script Agent"){
  if(!isString(value.title)||!isString(value.logline)||!isString(value.language)||!isString(value.format)||!Number.isInteger(value.durationSeconds)||Number(value.durationSeconds)<1||!isArray(value.characters)||!isArray(value.scenes)||!isArray(value.productionNotes))fail(role,"expected title, logline, language, format, durationSeconds, characters[], scenes[], productionNotes[]");
  for(const character of value.characters as unknown[]){if(!isObject(character)||!isString(character.name)||!isString(character.voiceIntent))fail(role,"invalid character")}
  for(const scene of value.scenes as unknown[]){if(!isObject(scene)||!Number.isInteger(scene.sceneNumber)||!isString(scene.visual)||!isString(scene.dialogue)||!isString(scene.narration)||!Number.isInteger(scene.estimatedSeconds)||Number(scene.estimatedSeconds)<0)fail(role,"invalid scene")}
  if((value.productionNotes as unknown[]).some(x=>!isString(x)))fail(role,"productionNotes must contain strings");
 }
 if(role==="Narrator Agent"){
  if(!isString(value.language)||!isString(value.deliveryStyle)||!Number.isInteger(value.totalEstimatedSeconds)||!isArray(value.segments))fail(role,"expected language, deliveryStyle, totalEstimatedSeconds, segments[]");
  for(const segment of value.segments as unknown[]){if(!isObject(segment)||!Number.isInteger(segment.sceneNumber)||!isString(segment.text)||!Number.isInteger(segment.pauseAfterMs)||Number(segment.pauseAfterMs)<0||!isString(segment.emphasis)||!isString(segment.emotion)||!Number.isInteger(segment.estimatedSeconds)||Number(segment.estimatedSeconds)<0)fail(role,"invalid narration segment")}
 }
 if(role==="Voice Modulator Agent"){
  if(value.provider!=="neutral"||!isArray(value.voiceProfiles)||!isArray(value.mixNotes))fail(role,"expected provider neutral, voiceProfiles[], mixNotes[]");
  for(const profile of value.voiceProfiles as unknown[]){if(!isObject(profile)||!isString(profile.speaker)||!isString(profile.voiceStyle)||!isString(profile.pitch)||!isString(profile.speed)||!isString(profile.tone)||!isString(profile.emotion)||!isString(profile.pronunciationNotes))fail(role,"invalid voice profile")}
  if((value.mixNotes as unknown[]).some(x=>!isString(x)))fail(role,"mixNotes must contain strings");
 }
 if(role==="Improvisor"){
  const ideas=value.ideas,assumptions=value.assumptions;
  if(!isArray(ideas)||!isString(value.recommendedDirection)||!isArray(assumptions))fail(role,"expected ideas[], recommendedDirection, assumptions[]");
  for(const idea of ideas as unknown[]){if(!isObject(idea)||!isString(idea.title)||!isString(idea.description)||!isString(idea.impact)||!isArray(idea.risks))fail(role,"invalid idea item")}
 }
 if(role==="Implementation Agent"){
  const steps=value.steps;
  if(!isArray(steps)||!isArray(value.requirements)||!isArray(value.risks)||!isString(value.rollback))fail(role,"expected steps[], requirements[], risks[], rollback");
  for(const step of steps as unknown[]){if(!isObject(step)||!isString(step.id)||!isString(step.title)||!isString(step.description)||!isString(step.ownerRole)||!isArray(step.dependencies)||!isArray(step.acceptanceCriteria))fail(role,"invalid implementation step")}
 }
 if(role==="Patcher"){
  if(value.target!=="projects.creative_brief"||!isString(value.before)||!isString(value.after)||value.after.length>20000||!isString(value.summary)||!isArray(value.changeSet)||value.reversible!==true)fail(role,"invalid patch schema or target");
 }
 if(role==="Auditor"){
  const findings=value.findings;
  if(!["pass","needs_changes","fail"].includes(String(value.verdict))||!Number.isInteger(value.score)||Number(value.score)<0||Number(value.score)>100||!isArray(findings)||!isArray(value.requiredHumanChecks)||!isString(value.summary))fail(role,"invalid verdict, score, findings, checks, or summary");
  for(const finding of findings as unknown[]){if(!isObject(finding)||!["critical","high","medium","low"].includes(String(finding.severity))||!isString(finding.finding)||!isString(finding.evidence)||!isString(finding.recommendation))fail(role,"invalid finding")}
 }
 return value;
}
