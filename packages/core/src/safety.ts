export type SafetyStatus="clear"|"uncertain"|"violation";
export interface SafetyGateResult {status:SafetyStatus;checks:string[];findings:string[];stage:"input"|"prompt"|"asset"|"generation"|"edit"|"final";reviewedAt:string;}
/** Fail-closed contract. Production classifiers must be connected before deployment. */
export function safetyGateUnavailable(stage:SafetyGateResult["stage"]):SafetyGateResult {
 return {status:"uncertain",checks:["safety-classifier-not-configured"],findings:["No production safety classifier is connected; this stage must not auto-approve."],stage,reviewedAt:new Date().toISOString()};
}
