# Agent Worker Orchestration and Router

The worker now has an explicit agent registry including a supervisor role, dependency graph validator, deterministic task router, retry budget, and human-approval pause semantics.

- Agents register by role; duplicate registrations fail. The supervisor role can be scheduled after other tasks to review their results and enforce workflow gates.
- Tasks have IDs, role, dependencies, input, retry budget, and optional HITL gate.
- Graph validation rejects duplicate IDs, missing dependencies, and cycles before execution.
- Tasks execute only when dependencies complete. Failed/blocked upstream tasks prevent downstream execution.
- Human approval pauses the pipeline; it does not auto-approve or continue.
- Provider router honors the explicitly selected provider. It never silently swaps to an unreviewed adapter.
- The provider route currently selects only adapters registered in-process. Real generation still requires reviewed provider adapters and secrets; this change does not pretend otherwise.

## Worker orchestration contract
Use `orchestrateAgents(job, tasks, registry)` to run a task graph. Each executor receives the current context/results and returns a typed status. Keep LLM calls in role-specific executors; deterministic policy gates remain outside LLM output.
