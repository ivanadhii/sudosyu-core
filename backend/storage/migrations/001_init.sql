-- Enable TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Servers
CREATE TABLE IF NOT EXISTS servers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    api_key_hash TEXT NOT NULL,
    tags        TEXT[] DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT NOT NULL UNIQUE,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('superadmin', 'coordinator', 'watcher')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User server access
CREATE TABLE IF NOT EXISTS user_server_access (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    permissions TEXT[] NOT NULL DEFAULT '{}',
    granted_by  UUID NOT NULL REFERENCES users(id),
    UNIQUE(user_id, server_id)
);

-- Metrics (TimescaleDB hypertable)
CREATE TABLE IF NOT EXISTS metrics_raw (
    time        TIMESTAMPTZ NOT NULL,
    server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    metric_type TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    value       DOUBLE PRECISION NOT NULL
);
SELECT create_hypertable('metrics_raw', by_range('time'), if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_metrics_server_time ON metrics_raw (server_id, time DESC);

-- Continuous aggregates: 1-minute rollup
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_1m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 minute', time) AS bucket,
    server_id,
    metric_type,
    metric_name,
    avg(value) AS value
FROM metrics_raw
GROUP BY bucket, server_id, metric_type, metric_name;

-- Continuous aggregates: 5-minute rollup
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_5m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('5 minutes', time) AS bucket,
    server_id,
    metric_type,
    metric_name,
    avg(value) AS value
FROM metrics_raw
GROUP BY bucket, server_id, metric_type, metric_name;

-- Retention policies
SELECT add_retention_policy('metrics_raw', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_retention_policy('metrics_1m',  INTERVAL '30 days', if_not_exists => TRUE);
SELECT add_retention_policy('metrics_5m',  INTERVAL '1 year',  if_not_exists => TRUE);

-- Container snapshots
CREATE TABLE IF NOT EXISTS container_snapshots (
    time          TIMESTAMPTZ NOT NULL,
    server_id     UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    container_id  TEXT NOT NULL,
    name          TEXT NOT NULL,
    image         TEXT NOT NULL,
    status        TEXT NOT NULL,
    uptime        TEXT,
    restart_count INT DEFAULT 0,
    ports         TEXT[] DEFAULT '{}',
    cpu_percent   DOUBLE PRECISION,
    mem_mb        DOUBLE PRECISION,
    mem_percent   DOUBLE PRECISION,
    net_in        DOUBLE PRECISION,
    net_out       DOUBLE PRECISION,
    block_read    DOUBLE PRECISION,
    block_write   DOUBLE PRECISION
);
SELECT create_hypertable('container_snapshots', by_range('time'), if_not_exists => TRUE);
SELECT add_retention_policy('container_snapshots', INTERVAL '7 days', if_not_exists => TRUE);

-- Docker system df snapshots
CREATE TABLE IF NOT EXISTS docker_df_snapshots (
    time                   TIMESTAMPTZ NOT NULL,
    server_id              UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    images_size            BIGINT,
    images_reclaimable     BIGINT,
    containers_size        BIGINT,
    volumes_size           BIGINT,
    volumes_reclaimable    BIGINT,
    build_cache_size       BIGINT,
    build_cache_reclaimable BIGINT
);
SELECT create_hypertable('docker_df_snapshots', by_range('time'), if_not_exists => TRUE);
SELECT add_retention_policy('docker_df_snapshots', INTERVAL '30 days', if_not_exists => TRUE);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id        UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    metric           TEXT NOT NULL,
    condition        TEXT NOT NULL CHECK (condition IN ('gt', 'lt')),
    threshold        DOUBLE PRECISION NOT NULL,
    duration_seconds INT NOT NULL DEFAULT 60,
    channel          TEXT NOT NULL DEFAULT 'webhook',
    webhook_url      TEXT NOT NULL,
    active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alert history
CREATE TABLE IF NOT EXISTS alert_history (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id   UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    server_id  UUID NOT NULL,
    fired_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    value      DOUBLE PRECISION
);

-- Container watches (alert on state change for specific containers)
CREATE TABLE IF NOT EXISTS container_watches (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id          UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    container_name     TEXT NOT NULL,
    webhook_url        TEXT NOT NULL,
    last_status        TEXT,
    last_container_id  TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(server_id, container_name)
);
-- Idempotent: add column if upgrading from older schema
ALTER TABLE container_watches ADD COLUMN IF NOT EXISTS last_container_id TEXT;

-- Super API Keys (one key works for all servers; server auto-registered by name)
CREATE TABLE IF NOT EXISTS super_api_keys (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    key_hash   TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alert templates (reusable sets of alert rules)
CREATE TABLE IF NOT EXISTS alert_templates (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_template_rules (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id      UUID NOT NULL REFERENCES alert_templates(id) ON DELETE CASCADE,
    metric           TEXT NOT NULL,
    condition        TEXT NOT NULL,
    threshold        DOUBLE PRECISION NOT NULL,
    duration_seconds INT NOT NULL DEFAULT 60,
    webhook_url      TEXT NOT NULL
);

-- Default superadmin (password: admin — CHANGE IN PRODUCTION)
-- password hash for 'admin': $2a$12$... (generated at runtime via migration helper)
