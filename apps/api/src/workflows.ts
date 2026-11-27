import { requireDb } from "./db.js";

export type RunStatus = "pending" | "running" | "paused" | "awaiting_approval" | "completed" | "failed" | "cancelled";
const allowed: Record<RunStatus, RunStatus[]> = {
  pending: ["running", "cancelled"],
  running: ["paused", "awaiting_approval", "completed", "failed", "cancelled"],
  paused: ["running", "cancelled"],
  awaiting_approval: ["running", "cancelled"],
  completed: [],
  failed: ["running", "cancelled"],
  cancelled: [],
};

export function canTransition(from: RunStatus, to: RunStatus) {
  return allowed[from]?.includes(to) ?? false;
}

/** Persist a durable notification event for the top-level human supervisor. */
export async function notifyHuman(runId: string, event: string, payload: unknown) {
  const db = requireDb();
  return db.query(
    "INSERT INTO workflow_events(run_id,event_type,payload) VALUES($1,$2,$3) RETURNING *",
    [runId, "hitl_notification:" + event, payload],
  );
}

export async function createRun(projectId: string | null, name: string, graph: unknown) {
  const db = requireDb();
  const result = await db.query(
    "INSERT INTO workflow_runs(project_id,name,graph) VALUES($1,$2,$3) RETURNING *",
    [projectId, name, graph],
  );
  const run = result.rows[0];
  await db.query("INSERT INTO workflow_events(run_id,event_type,payload) VALUES($1,'created',$2)", [run.id, { name }]);
  await notifyHuman(run.id, "run_created", { name, projectId, status: "pending" });
  return run;
}

export async function transitionRun(id: string, to: RunStatus) {
  const db = requireDb();
  const c = await db.query("SELECT status FROM workflow_runs WHERE id=$1", [id]);
  if (!c.rowCount) throw new Error("Run not found");
  const from = c.rows[0].status as RunStatus;
  if (!canTransition(from, to)) throw new Error(`Invalid workflow transition: ${from} -> ${to}`);
  const r = await db.query("UPDATE workflow_runs SET status=$2,updated_at=now() WHERE id=$1 RETURNING *", [id, to]);
  await db.query("INSERT INTO workflow_events(run_id,event_type,payload) VALUES($1,'status_changed',$2)", [id, { from, to }]);
  if (to === "awaiting_approval" || to === "failed" || to === "paused" || to === "completed") {
    await notifyHuman(id, to, { from, to, requiresAction: to === "awaiting_approval" || to === "failed" });
  }
  return r.rows[0];
}

export async function saveCheckpoint(runId: string, nodeId: string, payload: unknown) {
  const db = requireDb();
  const r = await db.query(
    "INSERT INTO checkpoints(run_id,node_id,payload) VALUES($1,$2,$3) RETURNING *",
    [runId, nodeId, payload],
  );
  await db.query(
    "INSERT INTO workflow_events(run_id,event_type,payload) VALUES($1,'checkpoint_saved',$2)",
    [runId, { checkpointId: r.rows[0].id, nodeId }],
  );
  await notifyHuman(runId, "checkpoint_saved", { checkpointId: r.rows[0].id, nodeId });
  return r.rows[0];
}
