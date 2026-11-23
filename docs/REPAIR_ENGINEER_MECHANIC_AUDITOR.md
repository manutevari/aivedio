# Bug Fix Engineer · Mechanic · Master Auditor Protocol

This is the default incident and defect-remediation workflow for AIVEDIO. It is evidence-led, risk-aware, and requires a human approval gate for production-impacting actions.

## Roles

### Bug Fix Engineer
- Reproduce the defect and capture exact inputs, environment, expected/actual results, logs, and correlation IDs.
- Trace the failure through UI, API, database, worker, storage, and infrastructure as applicable.
- Record a root-cause hypothesis and test it before changing code.
- Make the smallest safe patch and add a regression test.

### Mechanic / Repair Engineer
- Inspect service health, configuration, dependency compatibility, environment variables, queues, connectivity, deployment configuration, and resource limits.
- Repair the actual failing component, not merely symptoms.
- Validate rollback/recovery steps and ensure secrets are never logged or committed.

### Independent Master Auditor
- Review the diagnosis and diff independently; do not accept the implementer's assertion as evidence.
- Challenge security, access-control, data integrity, failure modes, edge cases, observability, and regression risk.
- Confirm tests match the defect and include negative cases where appropriate.
- Verdict: PASS, FAIL, or CONDITIONAL PASS. A FAIL returns to diagnosis/repair.

## Workflow
1. Intake: assign incident/bug ID, severity, scope, affected version, and owner.
2. Reproduce: document reliable reproduction and expected vs actual behavior.
3. Diagnose: evidence-backed root cause (RCA), confidence 0–100%, and alternative hypotheses.
4. Repair: minimal change; avoid unrelated refactors.
5. Test: regression test, unit tests, integration tests, type/lint/build, security checks as applicable.
6. Independent audit: inspect diff and evidence; require explicit checklist sign-off.
7. Preview verification: deploy only to preview/staging; smoke-test actual runtime, endpoints, and affected user flow.
8. CAPA: corrective action, preventive action, owner, evidence, and closure criteria.
9. Monitor: define recurrence signal and observation window; reopen CAPA if reproduced.

## Severity
- S0 Critical: active data breach, destructive data loss, or widespread outage. Escalate immediately; contain with HITL.
- S1 High: core user journey unavailable, severe security or data integrity defect.
- S2 Medium: partial failure with workaround.
- S3 Low: cosmetic or low-impact issue.

## Evidence required to close
- Reproduction before fix (or reason impossible)
- RCA with evidence and confidence
- Patch/commit and changed-file summary
- Regression test(s) and actual test outputs
- Auditor verdict and findings
- Preview/staging runtime evidence
- CAPA: correction + prevention
- Monitoring/rollback plan

## Human approval gates
HITL approval is mandatory before production deployment, production migrations, destructive operations, security-policy changes, secret rotation, billing changes, or actions that may affect real users/data. Preview deploys and isolated tests are preferred. Do not mark an issue fixed solely because a build passed.

## Repair report template
- Incident:
- Severity:
- Reproduction:
- Expected / actual:
- RCA evidence:
- Confidence:
- Correction:
- Prevention:
- Tests and results:
- Auditor verdict:
- Preview/runtime verification:
- Rollback:
- Monitoring:
- Closure:
