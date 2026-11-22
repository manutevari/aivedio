CREATE TABLE IF NOT EXISTS audio_production_plans(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 production_cut_id UUID NOT NULL REFERENCES production_cuts(id) ON DELETE CASCADE,
 script_package_id UUID NOT NULL REFERENCES creative_script_packages(id) ON DELETE RESTRICT,
 version INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','applied','rejected')),
 readiness TEXT NOT NULL DEFAULT 'incomplete' CHECK(readiness IN ('ready','incomplete','review_required')),
 readiness_score INTEGER NOT NULL DEFAULT 0 CHECK(readiness_score BETWEEN 0 AND 100),
 target_duration_ms BIGINT NOT NULL CHECK(target_duration_ms>0),
 content JSONB NOT NULL DEFAULT '{}',
 created_by TEXT,
 reviewed_by TEXT,
 review_notes TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 approved_at TIMESTAMPTZ,
 applied_at TIMESTAMPTZ,
 UNIQUE(project_id,version)
);
CREATE INDEX IF NOT EXISTS audio_production_plans_project_version_idx ON audio_production_plans(project_id,version DESC);
CREATE INDEX IF NOT EXISTS audio_production_plans_cut_idx ON audio_production_plans(production_cut_id);
CREATE TABLE IF NOT EXISTS audio_analysis_jobs(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','completed','partial','failed')),
 thresholds JSONB NOT NULL DEFAULT '{}',
 attempt INTEGER NOT NULL DEFAULT 0,
 max_attempts INTEGER NOT NULL DEFAULT 3,
 available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 lease_owner TEXT,
 lease_expires_at TIMESTAMPTZ,
 error TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audio_analysis_jobs_claim_idx ON audio_analysis_jobs(status,available_at,created_at);
CREATE INDEX IF NOT EXISTS audio_analysis_jobs_project_idx ON audio_analysis_jobs(project_id,created_at DESC);
CREATE TABLE IF NOT EXISTS audio_analysis_reports(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
 job_id UUID REFERENCES audio_analysis_jobs(id) ON DELETE SET NULL,
 status TEXT NOT NULL,
 score REAL NOT NULL CHECK(score>=0 AND score<=100),
 metrics JSONB NOT NULL DEFAULT '{}',
 findings JSONB NOT NULL DEFAULT '[]',
 thresholds JSONB NOT NULL DEFAULT '{}',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audio_analysis_reports_asset_idx ON audio_analysis_reports(asset_id,created_at DESC);
CREATE INDEX IF NOT EXISTS audio_analysis_reports_project_idx ON audio_analysis_reports(project_id,created_at DESC);
