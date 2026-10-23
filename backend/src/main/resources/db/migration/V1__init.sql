-- SwiftKite v1 schema.
-- Auth tables are the existing schema (kept unchanged); the campaign delivery
-- domain is new. Flyway-managed (jpa ddl-auto=validate).
--
-- Conventions: UUID primary keys, CITEXT for user emails, token material stored
-- as SHA-256 hashes only, JSONB for structured payloads, TIMESTAMPTZ for time.

CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------------------
-- Auth (existing, unchanged)
-- ---------------------------------------------------------------------------

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT NOT NULL UNIQUE,
    password_hash TEXT,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_account_non_locked BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO roles (name, display_name) VALUES ('CREATOR', 'Creator');

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    CONSTRAINT uq_user_role UNIQUE (user_id, role_id)
);

CREATE TABLE user_identity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL,
    provider_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_identity_provider UNIQUE (provider, provider_id),
    CONSTRAINT uq_identity_user_provider UNIQUE (user_id, provider),
    CONSTRAINT user_identity_provider_check CHECK (provider IN ('LOCAL', 'GOOGLE'))
);

CREATE INDEX idx_user_identity_user_id ON user_identity (user_id);

CREATE TABLE refresh_token (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    previous_token_hash TEXT,
    previous_token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE oauth_login_code (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_hash TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES users (id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL,
    provider_id VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oauth_login_code_expires ON oauth_login_code (expires_at);

CREATE TABLE password_reset_token (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_reset_token_expires ON password_reset_token (expires_at);

-- ---------------------------------------------------------------------------
-- Campaigns (intent)
-- ---------------------------------------------------------------------------

CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    subject_template TEXT NOT NULL,
    preview_text TEXT,
    body_template TEXT NOT NULL,
    from_email TEXT NOT NULL,
    from_name TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    paused_reason VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_campaign_status CHECK (
        status IN ('DRAFT', 'SENDING', 'PAUSED', 'STOPPING', 'STOPPED', 'COMPLETED')
    ),
    CONSTRAINT ck_campaign_paused_reason CHECK (
        paused_reason IS NULL OR paused_reason IN ('USER', 'PROVIDER', 'RATE_LIMITED')
    )
);

CREATE INDEX idx_campaigns_user_created ON campaigns (user_id, created_at DESC);
CREATE INDEX idx_campaigns_status ON campaigns (status);

CREATE TABLE campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns (id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_campaign_recipient_email UNIQUE (campaign_id, email)
);

CREATE INDEX idx_campaign_recipients_campaign ON campaign_recipients (campaign_id);

-- ---------------------------------------------------------------------------
-- Deliveries (execution, immutable inputs)
-- ---------------------------------------------------------------------------

CREATE TABLE notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns (id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES campaign_recipients (id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    rendered_subject TEXT NOT NULL,
    rendered_body TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    provider_message_id TEXT,
    failure_code VARCHAR(30),
    detail TEXT,
    claimed_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_delivery_status CHECK (
        status IN ('PENDING', 'ATTEMPTING', 'ACCEPTED', 'FAILED', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'CANCELLED')
    ),
    CONSTRAINT ck_delivery_failure_code CHECK (
        failure_code IS NULL OR failure_code IN ('PROVIDER_REJECTED', 'OUTCOME_UNKNOWN')
    )
);

CREATE INDEX idx_deliveries_campaign_status ON notification_deliveries (campaign_id, status);
CREATE INDEX idx_deliveries_provider_message_id ON notification_deliveries (provider_message_id);
CREATE INDEX idx_deliveries_status_claimed ON notification_deliveries (status, claimed_at);

-- ---------------------------------------------------------------------------
-- Transactional outbox
-- ---------------------------------------------------------------------------

CREATE TABLE outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_id UUID NOT NULL,
    topic TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ
);

CREATE INDEX idx_outbox_unpublished ON outbox_events (created_at) WHERE published_at IS NULL;

-- ---------------------------------------------------------------------------
-- Webhook inbox (dedup)
-- ---------------------------------------------------------------------------

CREATE TABLE inbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    provider_event_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_inbox_provider_event UNIQUE (provider, provider_event_id),
    CONSTRAINT ck_inbox_status CHECK (status IN ('RECEIVED', 'PROCESSED', 'IGNORED'))
);
