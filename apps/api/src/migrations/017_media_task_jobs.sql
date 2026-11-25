CREATE TABLE IF NOT EXISTS media_task_jobs(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('speech.generate','text.translate','text.localize','text.transliterate','audio.denoise','script.critic','video.critic','quality.analyze')),
 execution_mode TEXT NOT NULL CHECK(execution_mode IN ('sync','async','stream')),
 requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
 input JSONB NOT NULL DEFAULT '{}',
 dependencies UUID[] NOT NULL DEFAULT '{}',
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('pending','queued','running','retrying','completed','failed','cancelled','awaiting_review')),
 attempt INTEGER NOT NULL DEFAULT 0,
 max_attempts INTEGER NOT NULL DEFAULT 3,
 available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 lease_owner TEXT,
 lease_expires_at TIMESTAMPTZ,
 result JSONB,
 error TEXT,
 created_by UUID,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS media_task_jobs_claim_idx ON media_task_jobs(status,available_at,created_at);
CREATE INDEX IF NOT EXISTS media_task_jobs_project_idx ON media_task_jobs(project_id,created_at DESC);
