CREATE TABLE IF NOT EXISTS password_reset_tokens(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE,
 expires_at TIMESTAMPTZ NOT NULL,
 used_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS agent_pipeline_runs(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 created_by UUID REFERENCES users(id) ON DELETE SET NULL,
 status TEXT NOT NULL DEFAULT 'awaiting_approval' CHECK(status IN ('awaiting_approval','approved','rejected','applied','failed')),
 input JSONB NOT NULL DEFAULT '{}'::jsonb,
 improvisor JSONB NOT NULL DEFAULT '{}'::jsonb,
 implementation_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
 audit JSONB NOT NULL DEFAULT '{}'::jsonb,
 patch JSONB NOT NULL DEFAULT '{}'::jsonb,
 human_decision TEXT CHECK(human_decision IN ('approve','reject')),
 human_notes TEXT,
 decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
 decided_at TIMESTAMPTZ,
 applied_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_pipeline_project_idx ON agent_pipeline_runs(project_id,created_at DESC);
