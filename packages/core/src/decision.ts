export type DecisionAction = "AUTONOMOUS_CONTINUE"|"USE_DEFAULTS"|"RESEARCH_MORE"|"AUTO_REPAIR"|"ASK_USER"|"HITL_APPROVAL"|"RETRY"|"BLOCK";
export interface DecisionInput {
  confidence: number; risk: "low"|"medium"|"high"|"critical"; impact: "low"|"medium"|"high";
  reversible: boolean; safetyStatus: "clear"|"uncertain"|"violation"; qualityStatus?: "pass"|"warning"|"fail"; missingCriticalInfo?: boolean;
}
export function decideNextAction(input: DecisionInput): {action:DecisionAction;reason:string} {
  if(input.safetyStatus==="violation") return {action:"BLOCK",reason:"Confirmed safety violation"};
  if(input.safetyStatus==="uncertain") return {action:"HITL_APPROVAL",reason:"Safety uncertainty requires review"};
  if(input.risk==="critical") return {action:"HITL_APPROVAL",reason:"Critical-risk operation"};
  if(input.missingCriticalInfo) return {action:"ASK_USER",reason:"Critical information is missing"};
  if(input.qualityStatus==="fail") return {action:"AUTO_REPAIR",reason:"Quality gate failed"};
  if(input.risk==="high" || (input.impact==="high" && !input.reversible)) return {action:"HITL_APPROVAL",reason:"High impact or irreversible action"};
  if(input.confidence>=0.9 && input.risk==="low") return {action:"AUTONOMOUS_CONTINUE",reason:"High confidence and low risk"};
  if(input.confidence>=0.75 && input.reversible) return {action:"USE_DEFAULTS",reason:"Acceptable confidence; reversible defaults"};
  return {action:"ASK_USER",reason:"Confidence below configured autonomy threshold"};
}
