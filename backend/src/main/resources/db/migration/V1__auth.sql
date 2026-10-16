-- SwiftKite v1 auth schema.
-- Conventions: UUID primary keys, CITEXT for emails (case-insensitive unique),
-- token material stored as SHA-256 hashes only, Flyway-managed (jpa ddl-auto=validate).

CREATE EXTENSION IF NOT EXISTS citext;

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

-- One row per auth identity: password-based (LOCAL) or social (GOOGLE).
-- A user may hold several rows (account linking); at least one credential
-- (password or linked provider) must always remain (enforced in code).
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

-- One active refresh lineage per user. Rotation stores the previous token hash
-- so a concurrent retry succeeds (grace window) while a true replay revokes
-- the lineage (reuse detection, RFC 9700 section 4.14.2).
CREATE TABLE refresh_token (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    previous_token_hash TEXT,
    previous_token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Single-use OAuth login codes bridging the provider redirect and the
-- frontend token exchange. Never stores tokens, only the login outcome.
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
