CREATE TABLE IF NOT EXISTS quality_jobs(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
 requested_by TEXT,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','completed','partial','failed')),
 expected_profile JSONB NOT NULL DEFAULT '{}',
 attempt INTEGER NOT NULL DEFAULT 0,
 max_attempts INTEGER NOT NULL DEFAULT 3,
 available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 lease_owner TEXT,
 lease_expires_at TIMESTAMPTZ,
 error TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quality_jobs_claim_idx ON quality_jobs(status,available_at,created_at);
CREATE INDEX IF NOT EXISTS quality_jobs_project_idx ON quality_jobs(project_id,created_at DESC);
CREATE TABLE IF NOT EXISTS quality_reports(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
 job_id UUID REFERENCES quality_jobs(id) ON DELETE SET NULL,
 stage TEXT NOT NULL,
 status TEXT NOT NULL,
 score REAL NOT NULL CHECK(score>=0 AND score<=100),
 action TEXT NOT NULL,
 safety_verdict TEXT NOT NULL DEFAULT 'unavailable',
 report JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quality_reports_project_idx ON quality_reports(project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS quality_reports_asset_idx ON quality_reports(asset_id,created_at DESC);
CREATE TABLE IF NOT EXISTS safety_reviews(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
 report_id UUID REFERENCES quality_reports(id) ON DELETE CASCADE,
 stage TEXT NOT NULL,
 verdict TEXT NOT NULL CHECK(verdict IN ('clear','uncertain','violation','unavailable')),
 reason_codes JSONB NOT NULL DEFAULT '[]',
 confidence REAL,
 policy_version TEXT NOT NULL,
 reviewed_by TEXT,
 review_notes TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS safety_reviews_project_idx ON safety_reviews(project_id,created_at DESC);
