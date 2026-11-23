CREATE TABLE IF NOT EXISTS production_cuts(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 plan_id UUID NOT NULL REFERENCES creative_plans(id) ON DELETE RESTRICT,
 script_package_id UUID NOT NULL REFERENCES creative_script_packages(id) ON DELETE RESTRICT,
 version INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','applied','archived')),
 readiness TEXT NOT NULL DEFAULT 'incomplete' CHECK(readiness IN ('ready','incomplete','review_required')),
 readiness_score INTEGER NOT NULL DEFAULT 0 CHECK(readiness_score BETWEEN 0 AND 100),
 target_duration_ms BIGINT NOT NULL CHECK(target_duration_ms>0),
 content JSONB NOT NULL DEFAULT '{}',
 created_by TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 applied_at TIMESTAMPTZ,
 UNIQUE(project_id,version)
);
CREATE INDEX IF NOT EXISTS production_cuts_project_version_idx ON production_cuts(project_id,version DESC);
CREATE INDEX IF NOT EXISTS production_cuts_status_idx ON production_cuts(project_id,status);
