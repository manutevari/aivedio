CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS projects (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT NOT NULL, mode TEXT NOT NULL DEFAULT 'flow',
 target JSONB NOT NULL DEFAULT '{"aspectRatio":"16:9","resolution":"1080p","fps":24}'::jsonb,
 status TEXT NOT NULL DEFAULT 'draft', creative_brief TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS scenes (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 scene_order INTEGER NOT NULL, title TEXT NOT NULL, prompt TEXT NOT NULL DEFAULT '', duration_seconds INTEGER NOT NULL DEFAULT 10,
 status TEXT NOT NULL DEFAULT 'planned', references_json JSONB NOT NULL DEFAULT '[]', selected_models JSONB NOT NULL DEFAULT '{}',
 metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(project_id,scene_order)
);
CREATE TABLE IF NOT EXISTS workflow_runs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
 name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', graph JSONB NOT NULL, current_node_id TEXT,
 state JSONB NOT NULL DEFAULT '{}', error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workflow_events (
 id BIGSERIAL PRIMARY KEY, run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
 event_type TEXT NOT NULL, payload JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS checkpoints (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
 node_id TEXT NOT NULL, payload JSONB NOT NULL DEFAULT '{}', artifact_version_ids JSONB NOT NULL DEFAULT '[]',
 approval_ids JSONB NOT NULL DEFAULT '[]', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scenes_project_order ON scenes(project_id,scene_order);
CREATE INDEX IF NOT EXISTS idx_runs_project_created ON workflow_runs(project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_run ON workflow_events(run_id,id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_run ON checkpoints(run_id,created_at DESC);
