# AIVEDIO Incident Control: HITL + HACCP/CAPA

## Status and scope

This document defines the operating control for defects, security findings, reliability incidents, and release blockers. It is a process specification; it does not itself create GitHub branch protection, Vercel deployment protection, or an autonomous verifier.

**Default posture: fail closed.** An agent may inspect, reproduce, propose, edit on an isolated branch, and run non-production tests. It must stop at approval gates. No approval may be inferred from silence, prior requests to "fix everything", a green CI run, or a checkbox in a generated report.

## Control principles

1. **Evidence before diagnosis:** record the observed symptom, environment, timestamp, reproduction steps, expected/actual behavior, and relevant logs. Redact credentials, tokens, personal data, and secrets.
2. **HACCP hazard analysis:** classify impact, likelihood, exposure, detectability, and blast radius. Identify control points and measurable limits.
3. **RCA before corrective action:** distinguish confirmed facts from hypotheses; state confidence and missing evidence.
4. **CAPA:** every accepted fix has a corrective action, a preventive action, a regression test, an owner, and objective closure criteria.
5. **Independent verification:** the authoring agent cannot mark its own change independently verified. A separate reviewer or human must inspect evidence and test results.
6. **Least privilege and isolation:** work on a non-production branch; use disposable test data and environments; do not expose secrets in logs or artifacts.
7. **Auditable decisions:** record approver identity, exact scope, commit SHA, environment, decision, and timestamp in the PR/incident record.

## Risk classification

| Level | Examples | Required control |
|---|---|---|
| Critical | data exposure, cross-tenant access, auth bypass, destructive migration, production outage | stop affected operation; human incident lead approval for containment and each consequential action |
| High | authorization defect, data integrity risk, unsafe output, release-blocking outage | human RCA acceptance and code/security review before merge |
| Medium | functional regression, degraded service, recoverable job failures | evidence-backed RCA, regression coverage, reviewer acceptance |
| Low | cosmetic/documentation-only issue with no security or data impact | normal review and CI; document rationale |

If impact is uncertain, classify at the higher plausible level until evidence reduces the risk.

## State machine and gates

`DETECTED → TRIAGED → INVESTIGATING → RCA_PENDING_HUMAN → FIX_PROPOSED → FIX_PENDING_HUMAN → TESTING → VERIFICATION_PENDING_HUMAN → RELEASE_PENDING_HUMAN → POST_RELEASE_MONITORING → CLOSURE_PENDING_HUMAN → CLOSED`

Any failed check, new evidence, regression, or changed scope moves the record to `REOPENED`. A reopened incident returns to `INVESTIGATING`.

### Gate 1 — Triage and containment
- Agent may collect read-only evidence and recommend containment.
- For Critical/High issues, do not perform disruptive containment, revoke access, rotate credentials, or alter production without explicit human authorization unless a separately approved emergency runbook explicitly permits it.
- Record severity, affected assets/tenants, scope, and immediate risk.

### Gate 2 — RCA acceptance
Submit: reproduction, evidence links, confirmed facts vs hypotheses, root cause, confidence, contributing conditions, and residual unknowns.
- Human decision: `ACCEPT`, `REJECT`, or `NEED_MORE_EVIDENCE`.
- No implementation of a high-risk behavioral change until RCA is accepted.

### Gate 3 — Fix approval
Submit: proposed diff/commit, threat and regression analysis, migration/compatibility impact, rollback plan, and test plan.
- Human decision is required before merge or any production-affecting change.
- Keep work isolated on a branch and open a Draft PR where appropriate.

### Gate 4 — Verification
Required evidence, as applicable:
- unit, integration, and end-to-end tests;
- typecheck, lint, build, dependency/security checks;
- authorization matrix including owner/editor/reviewer/non-member and cross-project cases;
- negative tests proving unauthorized access remains denied/concealed;
- preview/runtime smoke tests and health/readiness checks;
- migration dry-run and rollback validation for schema changes.
A green CI is necessary but not sufficient. A separate reviewer must inspect the actual run, commit SHA, logs, and coverage of the risk.

### Gate 5 — Release authorization
Human must approve the exact commit SHA, target environment, deployment method, migration plan, monitoring window, and rollback trigger. No deployment is authorized by a generic instruction to fix bugs.

### Gate 6 — Closure
Do not close until:
- accepted RCA and CAPA are linked;
- all corrective/preventive actions are complete or explicitly risk-accepted;
- regression and independent verification evidence is attached;
- production/preview monitoring meets stated limits for the agreed window, if deployed;
- residual risk and follow-up owner are recorded;
- human incident owner explicitly approves closure.

## Mandatory stop conditions

Stop and request human direction if:
- evidence conflicts or RCA confidence is low for a High/Critical issue;
- a fix requires secrets, permissions, billing, external account settings, data deletion, irreversible migration, merge, or production deployment;
- CI is flaky or fails without a reproducible explanation;
- tests do not cover the affected security boundary;
- the proposed fix expands scope beyond the approved change;
- rollback cannot be demonstrated or the release has no safe rollback.

## Incident record template

- Incident ID / title:
- Reporter / incident owner:
- First observed (UTC):
- Environment and affected version/commit:
- Severity and rationale:
- Asset, tenant, route, and data scope:
- Expected vs actual:
- Reproduction steps:
- Evidence links (redacted):
- Confirmed facts:
- Hypotheses / unknowns:
- Root cause and confidence:
- Hazard analysis and control limits:
- Corrective action:
- Preventive action:
- Regression tests and results:
- Independent reviewer and verdict:
- Rollback plan:
- Human approvals (decision, approver, UTC time, exact commit/scope):
- Release/monitoring evidence:
- Residual risk / follow-up:
- Closure decision:

## Approval record format

Use an explicit PR/issue comment, not an implied signal:

`HITL APPROVAL: <RCA | FIX | MERGE | DEPLOY | MIGRATION | CLOSE>`
`Approver: <GitHub identity>`
`Scope: <exact change, commit SHA, environment, and permitted action>`
`Conditions: <tests, limits, monitoring, rollback requirements>`
`Timestamp (UTC): <timestamp>`

An approval applies only to the named scope. A new commit or material scope change requires renewed approval.

## Current implementation boundary

This policy and the repository templates provide documentation and review prompts only. Enforcement of required reviewers, protected branches, environment approvals, deployment permissions, and signed approval records must be configured and verified separately in GitHub/Vercel settings. Do not represent those controls as active until their settings have been inspected and tested.
