export type NodeType =
  | "START" | "END" | "AGENT" | "CLASSIFIER" | "DECISION" | "TOOL"
  | "RESEARCH" | "HUMAN" | "CHECKPOINT" | "SAFETY" | "GENERATION"
  | "TRANSFORM" | "PARALLEL" | "JOIN" | "QA" | "REPAIR" | "RETRY"
  | "TIMELINE" | "RENDER" | "EXPORT" | "MEMORY" | "NOTIFICATION";
export type ExecutionMode = "DETERMINISTIC" | "LLM" | "HUMAN" | "EXTERNAL" | "MEDIA_WORKER" | "HYBRID";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type WorkflowStatus = "pending" | "queued" | "running" | "completed" | "failed" | "retrying" | "paused" | "awaiting_approval" | "cancelled" | "blocked";
export interface WorkflowNode {
  id: string; type: NodeType; mode: ExecutionMode; name: string; dependencies: string[];
  timeoutMs: number; maxRetries: number; checkpoint: boolean; risk: RiskLevel;
  requiresApproval: boolean; capabilities: string[];
  inputSchema?: Record<string, unknown>; outputSchema?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}
const typeMap: Record<string, NodeType> = {
  prompt:"AGENT",llm:"AGENT",reasoning:"AGENT",classify:"CLASSIFIER",decision:"DECISION",
  tool:"TOOL",research:"RESEARCH",human:"HUMAN",checkpoint:"CHECKPOINT",safety:"SAFETY",
  image:"GENERATION",video:"GENERATION",music:"GENERATION",audio:"GENERATION",voice:"GENERATION",animation:"GENERATION",
  transform:"TRANSFORM",parallel:"PARALLEL",join:"JOIN",quality:"QA",repair:"REPAIR",retry:"RETRY",
  timeline:"TIMELINE",render:"RENDER",export:"EXPORT",memory:"MEMORY",notification:"NOTIFICATION",start:"START",end:"END"
};
export function classifyNode(purpose: string, risk: RiskLevel = "low") {
  const normalized = purpose.trim().toLowerCase();
  const type = typeMap[normalized] ?? "AGENT";
  const mode: ExecutionMode = ["TOOL","RESEARCH","GENERATION","TRANSFORM","RENDER","EXPORT"].includes(type)
    ? "EXTERNAL" : type === "HUMAN" ? "HUMAN" : ["SAFETY","CHECKPOINT","DECISION"].includes(type) ? "DETERMINISTIC" : "HYBRID";
  return { type, mode, risk, checkpoint: risk === "high" || risk === "critical" || type === "GENERATION" || type === "RENDER",
    requiresApproval: risk === "high" || risk === "critical", suggestedTimeoutMs: type === "GENERATION" || type === "RENDER" ? 300000 : 60000 };
}
