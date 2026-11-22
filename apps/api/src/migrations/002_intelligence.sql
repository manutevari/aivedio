CREATE TABLE IF NOT EXISTS project_memory (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),project_id UUID REFERENCES projects(id) ON DELETE CASCADE,kind TEXT NOT NULL DEFAULT 'note',content TEXT NOT NULL,tags TEXT[] NOT NULL DEFAULT '{}',importance REAL NOT NULL DEFAULT .5,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english',coalesce(content,''))) STORED);
CREATE INDEX IF NOT EXISTS project_memory_search_idx ON project_memory USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS project_memory_project_idx ON project_memory(project_id,created_at DESC);
CREATE TABLE IF NOT EXISTS query_history(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),project_id UUID REFERENCES projects(id) ON DELETE SET NULL,query TEXT NOT NULL,intent TEXT,response_summary TEXT,cache_key TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS query_history_project_idx ON query_history(project_id,created_at DESC);
CREATE TABLE IF NOT EXISTS query_cache(cache_key TEXT PRIMARY KEY,value JSONB NOT NULL,expires_at TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS query_cache_expiry_idx ON query_cache(expires_at);
