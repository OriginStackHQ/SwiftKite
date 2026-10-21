-- SwiftKite V2: complete domain schema.
--
-- One migration for the whole v1 domain so boot validation can check the real
-- schema (JSONB, CITEXT, text IPs) before services are built. Future schema
-- changes go in V3+; never edit this file once applied.
--
-- Aligned with the v1 LLD (section 5 and Appendix A). Conventions: UUID PKs
-- (app-generated; DB default is a fallback), TIMESTAMPTZ everywhere, statuses
-- as TEXT + CHECK, updated_at via Hibernate @UpdateTimestamp (no DB trigger).

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------- publications
CREATE TABLE publications (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id                 TEXT NOT NULL UNIQUE CHECK (public_id ~ '^pub_[a-z0-9]{6,32}$'),
  owner_id                  UUID NOT NULL REFERENCES users(id),     -- no user-deletion flow in v1
  name                      TEXT NOT NULL,
  description               TEXT,
  from_name                 TEXT NOT NULL,
  from_email                CITEXT NOT NULL,
  reply_to                  CITEXT,
  -- Set only by a successful real test send; reset when the sender changes.
  sender_tested_at          TIMESTAMPTZ,
  confirmation_subject      TEXT NOT NULL DEFAULT 'Confirm your subscription',
  confirmation_preview_text TEXT,
  welcome_redirect_url      TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_publications_owner ON publications (owner_id);

-- ---------------------------------------------------------------- subscribers
CREATE TABLE subscribers (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id           UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  email                    CITEXT NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'PENDING'
                             CHECK (status IN ('PENDING','ACTIVE','UNSUBSCRIBED','BOUNCED','COMPLAINED')),
  consent_at               TIMESTAMPTZ,
  consent_ip               TEXT,
  -- Random nonce; the confirm token itself is HMAC-signed and never stored.
  confirm_nonce            TEXT,
  confirm_token_expires_at TIMESTAMPTZ,
  confirmation_sent_at     TIMESTAMPTZ,
  confirmed_at             TIMESTAMPTZ,
  unsubscribed_at          TIMESTAMPTZ,
  deleted_at               TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (publication_id, email)
);
CREATE INDEX idx_subscribers_pub_status  ON subscribers (publication_id, status);
CREATE INDEX idx_subscribers_pub_created ON subscribers (publication_id, created_at DESC);
-- pg_trgm's operator class is for text; cast CITEXT explicitly so the index is valid.
CREATE INDEX idx_subscribers_email_trgm  ON subscribers USING gin ((email::text) gin_trgm_ops);
CREATE INDEX idx_subscribers_deleted     ON subscribers (publication_id, deleted_at) WHERE deleted_at IS NOT NULL;

-- ---------------------------------------------------------------- campaigns
CREATE TABLE campaigns (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id     UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  duplicated_from_id UUID REFERENCES campaigns(id) ON DELETE SET NULL, -- source campaign when duplicated
  title              TEXT NOT NULL DEFAULT 'Untitled campaign',
  subject            TEXT NOT NULL DEFAULT '',
  preview_text       TEXT,
  content_json       JSONB,
  content_html       TEXT,
  status             TEXT NOT NULL DEFAULT 'DRAFT'
                       CHECK (status IN ('DRAFT','SCHEDULED','SENDING','COMPLETED')),
  scheduled_at       TIMESTAMPTZ,
  scheduled_timezone TEXT,
  -- Snapshot of the publication sender at send start.
  from_name          TEXT,
  from_email         CITEXT,
  reply_to           CITEXT,
  audience_count     INT,
  started_at         TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  -- Systemic-error backoff; workers ignore this campaign until it passes.
  send_not_before    TIMESTAMPTZ,
  version            INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_scheduled_has_time CHECK (status <> 'SCHEDULED' OR scheduled_at IS NOT NULL)
);
CREATE INDEX idx_campaigns_pub_status  ON campaigns (publication_id, status);
CREATE INDEX idx_campaigns_pub_created ON campaigns (publication_id, created_at DESC);
CREATE INDEX idx_campaigns_due         ON campaigns (scheduled_at) WHERE status = 'SCHEDULED';

-- ---------------------------------------------------------------- recipients
CREATE TABLE campaign_recipients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  -- NOT NULL because subscribers are soft-deleted; history is never orphaned.
  subscriber_id       UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'QUEUED'
                        CHECK (status IN ('QUEUED','ATTEMPTING','ACCEPTED','DELIVERED','DEFERRED',
                                          'BOUNCED','COMPLAINED','FAILED','SKIPPED')),
  skip_reason         TEXT CHECK (skip_reason IN ('UNSUBSCRIBED','BOUNCED','COMPLAINED','NOT_ELIGIBLE')),
  failure_code        TEXT CHECK (failure_code IN ('OUTCOME_UNKNOWN','PROVIDER_REJECTED','MAX_ATTEMPTS','EXPIRED')),
  batch_no            INT NOT NULL,
  attempt_count       INT NOT NULL DEFAULT 0,
  next_attempt_at     TIMESTAMPTZ,
  claimed_at          TIMESTAMPTZ,
  provider_message_id TEXT,
  last_error          TEXT,
  accepted_at         TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, subscriber_id)       -- idempotency guarantee
);
CREATE INDEX idx_recipients_campaign_status  ON campaign_recipients (campaign_id, status);
CREATE INDEX idx_recipients_campaign_batch   ON campaign_recipients (campaign_id, batch_no, status);
CREATE INDEX idx_recipients_campaign_updated ON campaign_recipients (campaign_id, updated_at);
CREATE UNIQUE INDEX uq_recipients_provider_msg ON campaign_recipients (provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX idx_recipients_stuck ON campaign_recipients (claimed_at)     WHERE status = 'ATTEMPTING';
CREATE INDEX idx_recipients_retry ON campaign_recipients (next_attempt_at) WHERE status = 'DEFERRED';
CREATE INDEX idx_recipients_queued_stale ON campaign_recipients (updated_at) WHERE status = 'QUEUED';

CREATE TABLE campaign_timeline (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  message     TEXT NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaign_timeline ON campaign_timeline (campaign_id, created_at DESC);

-- ---------------------------------------------------------------- webhooks & events
CREATE TABLE webhook_inbox (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          TEXT NOT NULL CHECK (provider IN ('SES','FAKE')),
  provider_event_id TEXT,                                  -- SNS MessageId
  payload           JSONB NOT NULL,
  status            TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED','PROCESSED','IGNORED','FAILED')),
  attempts          INT NOT NULL DEFAULT 0,
  next_attempt_at   TIMESTAMPTZ,
  error             TEXT,
  received_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at      TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_webhook_inbox_provider_event ON webhook_inbox (provider, provider_event_id) WHERE provider_event_id IS NOT NULL;
CREATE INDEX idx_webhook_inbox_pending ON webhook_inbox (received_at) WHERE status = 'RECEIVED';
CREATE INDEX idx_webhook_inbox_retry   ON webhook_inbox (status, next_attempt_at) WHERE status = 'RECEIVED';

CREATE TABLE email_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          TEXT NOT NULL DEFAULT 'FAKE' CHECK (provider IN ('SES','SMTP','FAKE','SYSTEM')),
  provider_event_id TEXT,                                  -- SNS MessageId; NULL for SYSTEM events
  publication_id    UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  campaign_id       UUID,                                  -- NULL for confirmation-email events
  recipient_id      UUID,                                  -- NULL for confirmation-email events
  subscriber_id     UUID NOT NULL,                          -- always set, including confirmation-email events
  type              TEXT NOT NULL CHECK (type IN ('DELIVERED','BOUNCE_HARD','BOUNCE_SOFT','COMPLAINT','UNSUBSCRIBE')),
  payload           JSONB,
  occurred_at       TIMESTAMPTZ NOT NULL,
  received_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_email_events_provider_event ON email_events (provider, provider_event_id) WHERE provider_event_id IS NOT NULL;
CREATE INDEX idx_email_events_campaign  ON email_events (campaign_id, type);
CREATE INDEX idx_email_events_recipient ON email_events (recipient_id);
CREATE INDEX idx_email_events_subscriber ON email_events (subscriber_id);

-- ---------------------------------------------------------------- outbox
CREATE TABLE outbox_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type TEXT NOT NULL,
  aggregate_id   UUID NOT NULL,
  event_type     TEXT NOT NULL,
  payload        JSONB NOT NULL,
  attempts       INT NOT NULL DEFAULT 0,
  last_error     TEXT,
  available_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at   TIMESTAMPTZ
);
CREATE INDEX idx_outbox_unpublished ON outbox_events (available_at, created_at) WHERE published_at IS NULL;
CREATE INDEX idx_outbox_aggregate    ON outbox_events (aggregate_type, aggregate_id);

-- Deliberately no suppressions / audit_log / daily_campaign_stats in v1:
-- suppression is subscriber status + per-publication hard bounce, the campaign
-- timeline replaces the audit trail, and analytics are deferred.
