CREATE TABLE IF NOT EXISTS auth_rate_limit_buckets(
 bucket_key TEXT PRIMARY KEY,
 attempt_count INTEGER NOT NULL CHECK(attempt_count>=0),
 reset_at TIMESTAMPTZ NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_rate_limit_buckets_reset_idx ON auth_rate_limit_buckets(reset_at);
