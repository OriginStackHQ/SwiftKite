# SwiftKite — v1 Implementation Plan & Project Context

> **Single source of truth for v1.** Design, build order, decisions and repo status. Read top to bottom once.
> **Goal:** Build a small system that is *clearly correct under failure*, not a large system with many features.
> **Stack:** Spring Boot + Java + PostgreSQL + RabbitMQ + Next.js. No microservices, no gRPC, no Kafka, no payments.

---

## 1. What to Build

A multi-tenant newsletter platform (Beehiiv-lite).

```
Creator (users table) 
  └── Publication (one creator owns many, public_id is non-secret e.g. pub_x7k2m9q)
       ├── Subscribers (email is unique per publication, status + soft delete)
       └── Campaigns (one issue)
            └── CampaignRecipients (one row per subscriber at send time, tracks delivery)
```

**Core Product Loop:**
1. Creator signs up, creates publication
2. Embeds form with `public_id` on their website
3. Reader submits email → double opt-in confirmation email
4. Creator writes campaign → test-send to self → schedule or send-now
5. System snapshots active subscribers into recipient rows, sends via queue with rate limiting
6. SES webhooks update delivery/bounce/complaint status
7. Every email has mandatory one-click unsubscribe footer + headers

---

## 2. Tech Stack (Locked, No Versions)

- **Backend:** Spring Boot, Spring Security (JWT), Spring Data JPA, Flyway, Spring AMQP, Bucket4j
- **API docs:** springdoc-openapi 3.x + Swagger UI (generated from controllers; see section 17)
- **DB:** PostgreSQL, CITEXT extension, UUIDs generated in app
- **Queue:** RabbitMQ, quorum queues, direct exchange
- **Mail:** `EmailProvider` interface → `FakeEmailProvider` (dev/tests), `SmtpEmailProvider` (Mailpit), `SesEmailProvider` (prod only)
- **Frontend:** Next.js App Router + React + TypeScript + Tailwind; TanStack Query + TanStack Form; one axios instance for all API calls (draft UI, adapt to backend).
- **Local infra:** system PostgreSQL on **5432**, local RabbitMQ, local Mailpit. **Do not use Docker Compose** in this environment.

**Deployable units:** Same codebase, two profiles
- `api`: REST controllers, public endpoints, webhook endpoint, outbox relay, inbox poller
- `worker`: RabbitMQ consumers, reconciler
- Local dev: `api,worker` together

**Critical Rule:** No transaction across provider call. No business logic in controllers. Every tenant query includes `owner_id` check in same SQL.

---

## 3. Data Model

### 3.1 Tables

**publications**
```sql
id UUID PK,
public_id TEXT UNIQUE NOT NULL, -- pub_[a-z0-9]{12}, random, non-secret, indexed
owner_id UUID NOT NULL REFERENCES users(id),
name TEXT NOT NULL,
description TEXT,
from_name TEXT NOT NULL,
from_email CITEXT NOT NULL, -- must be verified sender
reply_to CITEXT,
sender_tested_at TIMESTAMPTZ, -- set only after real test send succeeds, NULL otherwise
confirmation_subject TEXT NOT NULL DEFAULT 'Confirm your subscription',
confirmation_preview_text TEXT,
welcome_redirect_url TEXT, -- after confirm, redirect here if set
created_at, updated_at TIMESTAMPTZ
```

**subscribers**
```sql
id UUID PK,
publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
email CITEXT NOT NULL,
status TEXT NOT NULL, -- PENDING, ACTIVE, UNSUBSCRIBED, BOUNCED, COMPLAINED
consent_at TIMESTAMPTZ,
consent_ip TEXT,
confirm_nonce TEXT, -- random, NULL when no confirmation pending
confirm_token_expires_at TIMESTAMPTZ, -- now+24h
confirmation_sent_at TIMESTAMPTZ, -- for 5m resend cooldown
confirmed_at TIMESTAMPTZ,
unsubscribed_at TIMESTAMPTZ,
deleted_at TIMESTAMPTZ, -- soft delete, status preserved
created_at, updated_at TIMESTAMPTZ,
UNIQUE(publication_id, email)
INDEX (publication_id, status)
```

**Eligibility Rule (single definition):** `status='ACTIVE' AND deleted_at IS NULL`. Used everywhere.

**campaigns**
```sql
id UUID PK,
publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
created_by UUID REFERENCES users(id) ON DELETE SET NULL,
duplicated_from_id UUID REFERENCES campaigns(id) ON DELETE SET NULL, -- source campaign when duplicated
title TEXT NOT NULL DEFAULT 'Untitled campaign',
subject TEXT NOT NULL,
preview_text TEXT,
content_json JSONB, -- TipTap doc
content_html TEXT, -- sanitized HTML, allowlist only
status TEXT NOT NULL, -- DRAFT, SCHEDULED, SENDING, COMPLETED
scheduled_at TIMESTAMPTZ, -- UTC instant
scheduled_timezone TEXT, -- display only, e.g. Asia/Kolkata
from_name, from_email, reply_to -- SNAPSHOT of publication sender at start
audience_count INT,
started_at, completed_at TIMESTAMPTZ,
send_not_before TIMESTAMPTZ, -- systemic backoff until this time
version INT NOT NULL, -- optimistic lock
created_at, updated_at
INDEX (publication_id, status)
PARTIAL INDEX (scheduled_at) WHERE status='SCHEDULED'
```

**campaign_recipients** — most important table
```sql
id UUID PK, -- also sent to SES as tag recipient_id
campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
status TEXT NOT NULL, -- QUEUED, ATTEMPTING, ACCEPTED, DELIVERED, BOUNCED, COMPLAINED, DEFERRED, FAILED, SKIPPED
skip_reason TEXT, -- UNSUBSCRIBED, BOUNCED, COMPLAINED, NOT_ELIGIBLE
failure_code TEXT, -- OUTCOME_UNKNOWN, PROVIDER_REJECTED, MAX_ATTEMPTS, EXPIRED
batch_no INT NOT NULL, -- (row_number-1)/25 at snapshot
attempt_count INT DEFAULT 0, -- counts definitive per-recipient failures only
next_attempt_at TIMESTAMPTZ,
claimed_at TIMESTAMPTZ,
provider_message_id TEXT, -- SES mail.messageId
last_error TEXT,
accepted_at, delivered_at TIMESTAMPTZ,
created_at, updated_at,
UNIQUE(campaign_id, subscriber_id) -- snapshot idempotency
INDEX (campaign_id, status)
INDEX (campaign_id, batch_no, status) -- worker claim
INDEX (campaign_id, updated_at) -- reconciler activity check
PARTIAL UNIQUE (provider_message_id) WHERE provider_message_id IS NOT NULL
PARTIAL INDEX (claimed_at) WHERE status='ATTEMPTING'
```

**campaign_timeline** — human-readable history
```sql
id UUID PK, campaign_id FK CASCADE, type TEXT, message TEXT, metadata JSONB, created_at
-- types: SCHEDULED, UNSCHEDULED, START_FAILED, STARTED, PROVIDER_BACKOFF, RECONCILER_REPUBLISH, STALE_RECOVERED, EXPIRED, COMPLETED
INDEX (campaign_id, created_at DESC)
```

**outbox_events**
```sql
id UUID PK, -- becomes RabbitMQ messageId
aggregate_type TEXT NOT NULL, -- CAMPAIGN, SUBSCRIBER
aggregate_id UUID NOT NULL, -- no FK on purpose
event_type TEXT NOT NULL, -- CAMPAIGN_BATCH_READY, CONFIRMATION_EMAIL_REQUESTED
payload JSONB NOT NULL, -- ids only, never content or tokens
attempts INT DEFAULT 0,
last_error TEXT,
available_at TIMESTAMPTZ NOT NULL,
created_at NOT NULL,
published_at TIMESTAMPTZ,
INDEX (available_at, created_at) WHERE published_at IS NULL
-- No status enum: published_at IS NULL = pending. attempts/last_error/available_at
-- are the relay's retry clock.
```

**webhook_inbox** — raw durable receipt
```sql
id UUID PK,
provider TEXT NOT NULL, -- SES, FAKE
provider_event_id TEXT, -- SNS MessageId, unique per notification
payload JSONB NOT NULL,
status TEXT NOT NULL, -- RECEIVED, PROCESSED, IGNORED, FAILED
attempts INT DEFAULT 0,
next_attempt_at TIMESTAMPTZ,
error TEXT,
received_at, processed_at,
PARTIAL UNIQUE (provider, provider_event_id) WHERE provider_event_id IS NOT NULL
PARTIAL INDEX (received_at) WHERE status='RECEIVED'
```

**email_events** — normalized append-only history
```sql
id UUID PK,
provider TEXT NOT NULL, -- SES, SMTP, FAKE, SYSTEM
provider_event_id TEXT, -- SNS MessageId, NULL for SYSTEM
publication_id UUID NOT NULL FK CASCADE,
campaign_id UUID, -- NULL for confirmation emails
recipient_id UUID,
subscriber_id UUID NOT NULL,
type TEXT NOT NULL, -- DELIVERED, BOUNCE_HARD, BOUNCE_SOFT, COMPLAINT, UNSUBSCRIBE
payload JSONB,
occurred_at TIMESTAMPTZ NOT NULL, -- provider timestamp
received_at TIMESTAMPTZ NOT NULL,
PARTIAL UNIQUE (provider, provider_event_id) WHERE provider_event_id IS NOT NULL
INDEX (campaign_id, type), INDEX (recipient_id), INDEX (subscriber_id)
```

**Auth tables already exist (V1 migration):** users, roles, user_roles, user_identity, refresh_token, oauth_login_code. Do not recreate.

### 3.2 Three IDs - Do Not Confuse

- `campaign_recipients.id` — our id for one intended email, sent as SES tag `recipient_id`
- `campaign_recipients.provider_message_id` — SES's `mail.messageId` returned on accept
- `webhook_inbox.provider_event_id` / `email_events.provider_event_id` — SNS `MessageId`, id of ONE notification. One email can produce multiple (delivery then complaint). Dedupe on SNS MessageId, not SES messageId.

---

## 4. State Machines (Enforce in Code + DB)

### 4.1 Subscriber

```
(new) -> PENDING --confirm--> ACTIVE
PENDING -> UNSUBSCRIBED / BOUNCED / COMPLAINED (confirmation email can bounce/complain/unsubscribe)
ACTIVE -> UNSUBSCRIBED / BOUNCED / COMPLAINED
UNSUBSCRIBED -> PENDING (re-subscribe with new confirmation) / BOUNCED / COMPLAINED (late events)
BOUNCED, COMPLAINED = terminal, never auto-reactivate
Soft-deleted: keeps status + deleted_at. Re-enrol only if status in (PENDING, ACTIVE, UNSUBSCRIBED) -> clears deleted_at, sets PENDING, new confirmation. BOUNCED/COMPLAINED -> does nothing.
```

Transitions: `canTransitionTo()` on enum. Check in service layer.

### 4.2 Campaign

```
DRAFT --schedule--> SCHEDULED --due--> SENDING --all recipients terminal--> COMPLETED
DRAFT --send now--> SENDING
SCHEDULED --unschedule--> DRAFT
```
- Edit/delete only in DRAFT. To change scheduled: unschedule → edit → schedule.
- No FAILED, PAUSED, CANCELLED. Individual recipients can fail; campaign still COMPLETES.
- COMPLETED means sending work finished, not that every email delivered. Late webhooks still update recipients after COMPLETED.

Allowed: DRAFT→SCHEDULED,SENDING; SCHEDULED→DRAFT,SENDING; SENDING→COMPLETED

### 4.3 Recipient

```
QUEUED --claim--> ATTEMPTING --accepted--> ACCEPTED --> DELIVERED --> BOUNCED/COMPLAINED
        --ineligible--> SKIPPED   ATTEMPTING --definitive failure--> FAILED
                      ATTEMPTING --transient not accepted--> DEFERRED --claim--> ATTEMPTING
                      ATTEMPTING --ineligible--> SKIPPED
        --expired--> FAILED(EXPIRED)
ACCEPTED --via webhook--> BOUNCED/COMPLAINED
FAILED(OUTCOME_UNKNOWN) --late truth wins--> DELIVERED/BOUNCED/COMPLAINED
DELIVERED --> BOUNCED/COMPLAINED
Precedence for out-of-order: COMPLAINED > BOUNCED > DELIVERED > ACCEPTED. Ignore late DELIVERED after BOUNCED.
```

Allowed: QUEUED→ATTEMPTING,SKIPPED,FAILED; ATTEMPTING→ACCEPTED,DEFERRED,FAILED,SKIPPED; DEFERRED→ATTEMPTING,FAILED,SKIPPED; ACCEPTED→DELIVERED,BOUNCED,COMPLAINED; DELIVERED→BOUNCED,COMPLAINED; FAILED with OUTCOME_UNKNOWN→DELIVERED,BOUNCED,COMPLAINED; BOUNCED,COMPLAINED,SKIPPED terminal.

**Attempts:** 3 total. 1st immediate, 2nd after 1m, 3rd after 5m. 3rd failure → FAILED/MAX_ATTEMPTS.

---

## 5. Messaging

### 5.1 Topology

```
Exchange: swiftkite.events (direct, durable)
  routing key campaign.batch --> queue campaign.send.batch (quorum, delivery-limit 5) --DLQ--> campaign.send.dlq
  routing key mail.confirm   --> queue mail.confirmation (quorum, delivery-limit 3) --DLQ--> mail.confirmation.dlq
```

- No TTL retry queues. Retry timing lives in DB (`next_attempt_at`, `send_not_before`).
- Manual acks. Prefetch 1 for batch queue (each message processes up to 25 sends). Concurrency 1 default.
- DLQ is informational. Dead-lettered batch is NOT lost work — recipient rows still QUEUED/DEFERRED, reconciler re-wakes them. Alert if DLQ depth >0.
- Confirmation DLQ = gave up sending confirmation link; subscriber can resubmit form after cooldown.

### 5.2 Envelope (Versioned)

```json
{
  "messageId": "<outbox_events.id>",
  "type": "CAMPAIGN_BATCH_READY",
  "version": 1,
  "occurredAt": "2026-10-21T10:15:00Z",
  "data": { "campaignId": "uuid", "batchNo": 17 }
}
```

Messages carry IDs only. Consumers load state from DB. No subject/body/email/token in queue.

Types:
- `CAMPAIGN_BATCH_READY` → {campaignId, batchNo} → batch consumer
- `CONFIRMATION_EMAIL_REQUESTED` → {subscriberId} → confirmation consumer

### 5.3 Outbox Relay (poll every 1s)

1. Short transaction: `SELECT id FROM outbox_events WHERE published_at IS NULL AND available_at <= now() ORDER BY created_at LIMIT 200 FOR UPDATE SKIP LOCKED`; commit. v1 runs a single relay, so duplicate delivery is acceptable.
2. Publish each message to RabbitMQ with publisher confirms — **outside any DB transaction**.
3. Second short transaction per row: on confirm set `published_at=now()`; on failure `attempts+=1, last_error, available_at=now()+min(2^attempts sec, 5m)`.

Crash between publish and mark = duplicate publish later. Consumers must be idempotent (they are). Never hold a transaction across RabbitMQ.

Cleanup job: delete outbox rows published_at >7d, processed webhook_inbox >30d.

### 5.4 Consumer Rules

1. Ack only after DB work durable, or when safe to drop (campaign not SENDING, gone).
2. Redelivered message = fewer or zero claimable rows, harmless.
3. Never hold DB tx across provider call.

---

## 6. Detailed Flows (Implement in This Order)

### 6.1 Publication + Sender Test

- `POST /publications` creates with `sender_tested_at=NULL`. `public_id` generated: `pub_` + 12 chars [a-z0-9] from SecureRandom.
- `PATCH /publications/{id}` — if from_name/from_email/reply_to changed → set `sender_tested_at=NULL`.
- `POST /publications/{id}/sender-test` — sends real email to creator's own email via EmailProvider, with tag kind=test. On success: `sender_tested_at=now()`. On failure: keep NULL, return provider error. Rate limit 5/hour.
- Delete: `DELETE /publications/{id}` — guard: no SENDING campaigns. Hard delete with CASCADE. Require confirmation param `?confirm=true`.

### 6.2 Public Subscribe (Double Opt-in, No Enumeration)

Request: `POST /api/public/subscribe` body `{publicationId: public_id, email, honeypot? website}`

1. Validate: email trimmed/lowercased, syntax, honeypot `website` must be empty, rate limit per IP + per public_id (Bucket4j).
2. Find publication by `public_id`. If not found → still return 200 generic (prevent enumeration) but do nothing.
3. Check suppression: if subscriber exists with status BOUNCED/COMPLAINED → return generic 200, do NOT send confirmation, do NOT change status.
4. Upsert subscriber:
   - If not exists: insert PENDING, consent_at=now(), consent_ip, confirm_nonce=random 32 chars, expires=now+24h, confirmation_sent_at=NULL
   - If exists and status in (PENDING, ACTIVE, UNSUBSCRIBED) and not soft-deleted: set PENDING, new nonce, new expiry, consent_at=now(). If soft-deleted and status allowed → clear deleted_at, set PENDING.
   - If BOUNCED/COMPLAINED → no-op.
5. If confirmation_sent_at is NULL or >5m ago: insert outbox row `CONFIRMATION_EMAIL_REQUESTED {subscriberId}`, set confirmation_sent_at=now(). Else skip (cooldown).
6. Return `200 {message: "If your email is valid, you'll receive confirmation"}` — same for all cases.

Token generation: HMAC-SHA256. Payload: `subscriber_id.confirm_nonce.expires_at`. Signature = HMAC(key=TOKEN_SIGNING_KEY, payload). Token = base64url(payload.signature). DB stores only nonce, not token.

### 6.3 Confirmation Email Consumer

Consumes `CONFIRMATION_EMAIL_REQUESTED {subscriberId}`

1. Load subscriber, publication.
2. If subscriber status != PENDING or nonce NULL or expired → ack drop.
3. Build confirmation link: `<backend-base>/api/public/confirm?token=<signed token>` — token built from current nonce. The link points at the API, not the frontend, because the API performs the transition and then redirects.
4. Render the email with `publication.confirmation_subject` and `confirmation_preview_text`.
5. Send via EmailProvider with tags `subscriber_id, kind=confirmation`.
6. No state change here. Ack.

### 6.4 Confirm Endpoint

`GET /api/public/confirm?token=...`

v1 mutates state on this GET. Link prefetchers can therefore confirm early; accepted trade-off. A page + POST split can be added later without changing the token format.

1. Verify HMAC signature, expiry, parse subscriber_id + nonce.
2. Load subscriber, check `confirm_nonce == nonce` and `confirm_token_expires_at > now()`.
3. Transition PENDING→ACTIVE: set `status=ACTIVE, confirmed_at=now(), confirm_nonce=NULL`.
4. If already ACTIVE and nonce matches → idempotent 200.
5. If expired → 410 with message "link expired, resubmit form".
6. Redirect to `publication.welcome_redirect_url` if set, else `${FRONTEND_URL}/confirm/success`; on expiry, `${FRONTEND_URL}/confirm/expired`.

### 6.5 Campaign Authoring

- `POST /api/publications/{id}/campaigns` creates DRAFT with title, subject, preview_text, content_json, content_html. Sanitize HTML: allowlist (no script, on*, iframe, javascript:). Store sanitized.
- `PATCH /api/campaigns/{cid}` — allowed only if status=DRAFT, with optimistic lock `WHERE id=:id AND version=:version`. Increment version.
- Content footer not creator-controlled. At send time, server wraps HTML and appends footer containing publication name + unsubscribe link. Creator cannot send without it.
- Preview: `GET /api/campaigns/{cid}/preview` returns rendered HTML with dummy unsubscribe link.
- Test send: `POST /api/campaigns/{cid}/test-send` — sends rendered campaign to creator's own email only, subject prefix `[TEST]`, tag kind=test. Rate limit 5/hour.
- Duplicate: `POST /api/campaigns/{cid}/duplicate` creates a new DRAFT copying subject/content/settings, sets `duplicated_from_id` to the source campaign, and copies no recipients.
- Delete: `DELETE /api/campaigns/{cid}` via `DELETE WHERE id=:id AND status='DRAFT'`, else 409.
- Audience estimate: `SELECT count(*) FROM subscribers WHERE publication_id=:p AND status='ACTIVE' AND deleted_at IS NULL`.

### 6.6 Schedule / Unschedule / Send Now

- Schedule: `POST /api/campaigns/{cid}/schedule {scheduledAt, timezone}` — validations: DRAFT, subject+content non-empty, sender_tested_at NOT NULL, scheduledAt >= now+2m and <= now+30d. Conditional update DRAFT→SCHEDULED, set scheduled_at UTC instant, timeline SCHEDULED. Timezone display only.
- Unschedule: `POST /api/campaigns/{cid}/unschedule` — `UPDATE SET status='DRAFT', scheduled_at=NULL WHERE id=:id AND status='SCHEDULED'`. 0 rows → 409 already started.
- Send now: `POST /api/campaigns/{cid}/send` calls start-sending routine immediately from DRAFT or SCHEDULED.
- Scheduled start: reconciler R1 calls same routine, so no drift.
- If scheduled campaign fails validation at start time (sender_tested_at reset) → set DRAFT + timeline START_FAILED, do NOT send.

### 6.7 Start Sending (One Transaction - Most Important)

```sql
-- tx start
SELECT ... FROM publications WHERE id=:pub FOR SHARE -- blocks concurrent delete

UPDATE campaigns SET status='SENDING', started_at=now(), 
  from_name=:fn, from_email=:fe, reply_to=:rt, version=version+1
WHERE id=:id AND publication_id=:pub AND status IN ('DRAFT','SCHEDULED')
-- 0 rows -> 409 conflict

-- validate preconditions in code (subject, content, sender_tested_at)
-- if fails -> rollback, for scheduled start set DRAFT + timeline START_FAILED

INSERT INTO campaign_recipients (id, campaign_id, subscriber_id, status, batch_no, created_at, updated_at)
SELECT gen_random_uuid(), :c, s.id, 'QUEUED',
       ((row_number() OVER (ORDER BY s.id) - 1) / 25)::int, now(), now()
FROM subscribers s
WHERE s.publication_id = :pub AND s.status='ACTIVE' AND s.deleted_at IS NULL
ON CONFLICT (campaign_id, subscriber_id) DO NOTHING;

-- audience_count = inserted rows
-- if 0 -> set COMPLETED immediately, timeline "no eligible subscribers", commit, finish

INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, available_at, created_at)
SELECT gen_random_uuid(), 'CAMPAIGN', :c, 'CAMPAIGN_BATCH_READY',
       jsonb_build_object('campaignId', :c, 'batchNo', gs.n),
       now(), now()
FROM generate_series(0, :lastBatch) AS gs(n);

INSERT INTO campaign_timeline (id, campaign_id, type, message, created_at)
VALUES (gen_random_uuid(), :c, 'STARTED', 'N recipients in M batches', now());

-- commit
```

Rules: snapshot once, never rebuilt. Relay publishes after commit. 100k recipients = one INSERT...SELECT (few seconds). Acceptable for v1.

### 6.8 Worker: Processing One Batch Message

Receives {campaignId, batchNo}

Setup (no tx):
1. Load campaign. Missing or status!=SENDING → ack drop.
2. If send_not_before > now() → ack drop (backing off, reconciler will re-wake).
3. Load publication sender snapshot + campaign content once.

Loop until no claimable rows:

a. Acquire rate-limit permit BEFORE claim (token bucket matched to provider rate)
b. Claim one row:
```sql
UPDATE campaign_recipients r
SET status='ATTEMPTING', claimed_at=now(), updated_at=now()
WHERE r.id = (
  SELECT id FROM campaign_recipients
  WHERE campaign_id=:c AND batch_no=:b
    AND status IN ('QUEUED','DEFERRED')
    AND (next_attempt_at IS NULL OR next_attempt_at <= now())
  ORDER BY id
  LIMIT 1
  FOR UPDATE SKIP LOCKED)
RETURNING id, subscriber_id, attempt_count
```
None left → exit loop.

c. Load subscriber (email, status, deleted_at) — no tx
d. Render HTML + plain text + headers (List-Unsubscribe, List-Unsubscribe-Post)
e. Eligibility check (late as possible): if subscriber status != ACTIVE or deleted_at NOT NULL → `UPDATE SET status='SKIPPED', skip_reason=... WHERE id=:id AND status='ATTEMPTING'` in short tx, continue
f. `EmailProvider.send(...)` with tags recipient_id, campaign_id — NO tx
g. Persist outcome (see 6.9) with conditional update `WHERE id=:id AND status='ATTEMPTING'` — short tx. If 0 rows → someone else changed it (reconciler), log, never overwrite.

End of batch: ack message. Crash mid-batch → message unacked, redelivered, continues with remaining rows. Row that was ATTEMPTING at crash handled by reconciler.

Rate limiting across instances: v1 in-memory token bucket per worker (config provider rate / workers). Document limitation.

### 6.9 Outcome Matrix (What Step g Does)

Provider adapter classifies every result into exactly one:

- Accepted (returns messageId): `ACCEPTED, provider_message_id, accepted_at`, continue
- Recipient-permanent (invalid address, rejected content): `FAILED, failure_code=PROVIDER_REJECTED, last_error`, continue
- Recipient-transient definitely not accepted (4xx RCPT TO "try later", mailbox full, provider explicitly says retry this recipient): `attempt_count+=1`. If >=3 → FAILED/MAX_ATTEMPTS else DEFERRED with next_attempt_at = now+1m (after 1st) or +5m (after 2nd), continue
- Systemic (auth failure, quota, account suspended, sender not verified, throttled, connection refused, DNS/TLS failure): `DEFERRED, attempt_count unchanged`, set `campaigns.send_not_before=now+5m` + timeline PROVIDER_BACKOFF if not already backing off. Stop this batch, ack. Other batches see send_not_before and stand down.
- Ambiguous (timeout after request sent, connection reset after DATA, 5xx/unparsable): `FAILED, failure_code=OUTCOME_UNKNOWN`, continue, never retried.

Rule: Retry only when we can prove nothing was accepted. When in doubt, throw Ambiguous.

Give-up: If campaign SENDING >24h, reconciler marks remaining QUEUED/DEFERRED → FAILED/EXPIRED.

### 6.10 Reconciler (Scheduled Every 30s)

All set-based, safe concurrent.

R1 Start due schedules:
`SELECT id FROM campaigns WHERE status='SCHEDULED' AND scheduled_at <= now() LIMIT 50` (no lock), commit. Call the normal start routine per campaign in its own transaction. The conditional `DRAFT/SCHEDULED → SENDING` update makes concurrent or duplicate starts safe: one wins, the rest see 0 rows.

R2 Stale ATTEMPTING:
```sql
UPDATE campaign_recipients SET status='FAILED', failure_code='OUTCOME_UNKNOWN',
  last_error='worker lost before result recorded', updated_at=now()
WHERE status='ATTEMPTING' AND claimed_at < now() - 10m
```
Timeline STALE_RECOVERED with count. Never return to QUEUED (provider may have accepted).

R3 Re-wake stalled campaigns (lost wake-ups, DLQ, backoff expiry, due retries):
Find SENDING with send_not_before null/passed, has actionable rows (QUEUED or DEFERRED due), no recipient updated_at > now-60s, no unpublished outbox row. For each, insert outbox rows for batch_nos that still have actionable rows (cap 500 per run). Timeline RECONCILER_REPUBLISH. Duplicate wake-ups harmless.

R4 Expire:
`SENDING WHERE started_at < now()-24h`: remaining QUEUED/DEFERRED → FAILED/EXPIRED.

R5 Complete:
```sql
UPDATE campaigns SET status='COMPLETED', completed_at=now(), version=version+1
WHERE status='SENDING' AND NOT EXISTS (SELECT 1 FROM campaign_recipients WHERE campaign_id=c.id AND status IN ('QUEUED','ATTEMPTING','DEFERRED'))
```
Timeline COMPLETED.

Why 60s no activity: healthy campaign constantly updates rows, reconciler stays away. Lost message noticed when idle.

### 6.11 Webhook Receive (SES via SNS)

`POST /api/webhooks/ses` (public but authenticated by signature)

1. Read SNS JSON body as text/plain. Reject unknown Type.
2. Verify: SigningCertURL https, host matches sns.<region>.amazonaws.com, path ends .pem, signature valid against cert (cache certs), TopicArn equals configured, Timestamp within 24h window (SNS retries long, so generous). Any failure → 403, nothing stored.
3. Type=SubscriptionConfirmation: verify and ack but NOT auto-follow (operator confirms in AWS console).
4. Type=Notification: `INSERT INTO webhook_inbox ... ON CONFLICT (provider, provider_event_id) DO NOTHING` with SNS MessageId. Return 200 immediately.

Duplicate delivery → inserts nothing, still 200.

Local dev: simulator endpoint (dev profile only) builds SES-shaped notifications for a given recipient and pushes through same inbox path, with signature verification replaced by no-op verifier. Build this before real SES.

### 6.12 Webhook Processing (Inbox Poller Every 5s)

Batch: `SELECT ... FROM webhook_inbox WHERE status='RECEIVED' AND (next_attempt_at IS NULL OR <=now()) ORDER BY received_at LIMIT 50 FOR UPDATE SKIP LOCKED`. Per row in one tx:

1. Parse SES Message. Supported: Delivery, Bounce, Complaint. Else → IGNORED reason UNSUPPORTED_TYPE.
2. Find target: try provider_message_id (SES mail.messageId), then tags recipient_id/campaign_id. If not found within 10m window → requeue with next_attempt_at=now+1m, keep RECEIVED. After 10m → IGNORED UNMATCHED.
3. Validate precedence: current recipient status vs new event. COMPLAINED > BOUNCED > DELIVERED > ACCEPTED. If incoming is lower → store email_events but don't move recipient backward, mark inbox PROCESSED.
4. Insert email_events with dedup on (provider, provider_event_id). On conflict → ignore.
5. Update recipient: DELIVERED → set delivered_at, BOUNCE_HARD → BOUNCED, BOUNCE_SOFT → store event only no state change (v1 does not suppress soft bounce), COMPLAINT → COMPLAINED, UNSUBSCRIBE → UNSUBSCRIBED (via system event).
6. Update subscriber: BOUNCE_HARD → BOUNCED, COMPLAINT → COMPLAINED, DELIVERED → nothing. Subscriber transitions enforced.
7. Insert timeline entry if needed.
8. Mark inbox PROCESSED.

Poller crash mid-batch → tx rollback, rows picked again, idempotent.

### 6.13 Unsubscribe

Every campaign email has:
- Visible link: `${FRONTEND_URL}/unsubscribe?token=...` — the frontend page confirms, then POSTs the token.
- Headers: `List-Unsubscribe: <backend-base>/api/public/unsubscribe?token=...>, <mailto:unsub@domain?subject=...>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`

Token: HMAC-SHA256 over `subscriber_id.campaign_id.purpose` with TOKEN_SIGNING_KEY. Purpose = unsubscribe. No DB storage needed.

`POST /api/public/unsubscribe` body `{token}`. The one-click header posts only the token.

On valid token: set subscriber status UNSUBSCRIBED, unsubscribed_at=now(), insert email_events type UNSUBSCRIBE provider SYSTEM. Worker eligibility check skips from that moment. No suppression table needed in this v1 (status is truth).

Re-subscribe after unsubscribe: requires new double opt-in, goes PENDING→ACTIVE again.

### 6.14 Publication Delete

Guard: `SELECT count(*) FROM campaigns WHERE publication_id=:p AND status='SENDING'` → if >0 → 409 cannot delete while sending.
Else hard delete: publication row CASCADE deletes subscribers, campaigns, recipients, timeline, email_events. Outbox rows have no FK, clean via job. Require `?confirm=true`.

---

## 7. Email Provider Abstraction

```java
public interface EmailProvider {
  SendResult send(EmailMessage msg) throws ProviderException;
}
public record EmailMessage(String fromName, String fromEmail, String replyTo, String to, String subject, String html, String text, Map<String,String> headers, Map<String,String> tags) {}
public record SendResult(String providerMessageId) {}

// Sealed exceptions:
RecipientPermanentException // will never succeed for this address
RecipientTransientException // definitely NOT accepted, safe to retry
SystemicProviderException // account/config problem, not accepted, backoff campaign
AmbiguousOutcomeException // may or may not have been sent, DO NOT retry
```

Rule: When in doubt, throw Ambiguous.

Classification:
- Address/content rejected: MessageRejected, invalid param, 5xx RCPT TO/DATA → Permanent
- 4xx RCPT TO try later, mailbox full, provider explicitly says retry this recipient → Transient
- Bad creds, 403, 535 auth, LimitExceeded, throttling, AccountSuspended, SendingPaused, MailFrom not verified, connection refused, DNS/TLS failure → Systemic
- Read timeout after sending, connection reset after DATA, 5xx service, unparsable → Ambiguous

Implementations:
- Fake: in-memory, configurable failure injection (permanent, transient, systemic, ambiguous, latency)
- Smtp: JavaMail, sets headers/tags as custom headers
- Ses: SDK v2 SendEmail with config set, tags, headers

Selected by `swiftkite.mail.provider = fake | smtp | ses`

Timeouts: connect 5s, read 30s. Bounds stale ATTEMPTING threshold.

---

## 8. API Contract

Base `/api`, RFC7807 ProblemDetail errors, pagination `?page=&size=` max 100, JWT Bearer + refresh cookie.

Auth: `POST /api/auth/*` already exists (sign-up, sign-in, sign-out, refresh, me, OAuth, providers). Account endpoints added 2026-10-21:
- `PATCH /api/auth/me` — update first/last name (email changes out of scope).
- `POST /api/auth/password` — set a password on an OAuth-only account.
- `POST /api/auth/password/change` — verify current password, rotate the session.
- `POST /api/auth/forgot-password` — always returns the same generic message (no account enumeration).
- `POST /api/auth/reset-password` — consumes a single-use link token, sets the password, revokes every session.

Forgot/reset never returns the reset URL. Tokens are random, stored as SHA-256 hashes, expire after 30 minutes by default, and are single-use.

Publications (auth):
- GET /api/publications, POST /api/publications
- GET/PATCH/DELETE /api/publications/{id}
- POST /api/publications/{id}/sender-test

Subscribers (auth):
- GET /api/publications/{id}/subscribers?status=&q=&page=&size=
- GET /api/publications/{id}/subscribers/{sid}
- DELETE /api/publications/{id}/subscribers/{sid} (soft delete)

Campaigns (auth):
- GET/POST /api/publications/{id}/campaigns
- GET/PATCH/DELETE /api/campaigns/{cid}
- POST /api/campaigns/{cid}/duplicate
- GET /api/campaigns/{cid}/preview
- POST /api/campaigns/{cid}/test-send
- POST /api/campaigns/{cid}/schedule {scheduledAt, timezone}, /unschedule, /send
- GET /api/campaigns/{cid}/progress -> {QUEUED:10, ACCEPTED:20, ... , ambiguous:1}
- GET /api/campaigns/{cid}/recipients?status=&page=&size=
- GET /api/campaigns/{cid}/timeline

Public (no auth):
- POST /api/public/subscribe
- GET /api/public/confirm?token=
- POST /api/public/unsubscribe
- POST /api/webhooks/ses

Status codes: 400 validation, 401 unauth, 404 not found OR not yours, 409 state conflict, 422 precondition (sender not tested), 429 rate limit.

All /api/campaigns/{cid}/... must resolve campaign through publication owner: `SELECT c FROM campaigns c JOIN publications p ON c.publication_id=p.id WHERE c.id=:cid AND p.owner_id=:userId` → if not found → 404.

---

## 9. Security & Tenant Isolation

- Every repository query that touches publication/campaign/subscriber includes owner_id in WHERE, same query, not two steps.
- public_id can only do subscribe, nothing else. Rate limit per IP + per public_id.
- Footer + List-Unsubscribe headers injected by server, cannot be bypassed by creator.
- HTML sanitized on save with allowlist (Jsoup Safelist relaxed + no script).
- Tokens: confirm token HMAC signed, `confirm_nonce` stored; the nonce is random and the signature secret, so no extra hashing at rest. Unsubscribe token HMAC signed, no storage.
- CORS locked to dashboard origin. Refresh cookie HttpOnly SameSite=Lax.
- Frontend keeps the access token in memory only; it is never written to localStorage/cookies. The refresh token stays in the HttpOnly cookie.
- Password reset: generic forgot response, single-use SHA-256-hashed token, 30-minute TTL, and all sessions revoked on success. No `expose-reset-token` switch and no reset URL in API responses.
- Secrets via env, never committed. .env gitignored, only .env.example committed.
- No SQL injection: JPA parameterized.
- Publication delete requires confirm flag.

---

## 10. Build Order for LLM

Implement in this exact order, each step must compile and boot:

1. **Publication CRUD** — entity, repo (owner-scoped queries), service, DTOs, controller, flyway V2, public_id generation. Swagger/OpenAPI is already wired (section 17); tag and document this controller as you build it.
2. **Subscribe + Double Opt-in** — subscriber entity/repo, public subscribe endpoint, outbox_events table + relay, confirmation consumer, confirm endpoint, token service.
3. **Campaign CRUD + Preview** — campaign entity/repo, create/edit/preview/duplicate/delete, sanitizer, timeline.
4. **Send Path** — EmailProvider interface + Fake impl, campaign_recipients entity, start-sending transaction (one method), outbox batch rows, RabbitMQ topology beans, batch consumer skeleton.
5. **Worker Loop + Outcome Matrix** — claim SQL, eligibility check, provider send, persist outcome, rate limiter, progress endpoint.
6. **Reconciler + Webhook Inbox** — webhook_inbox table + endpoint + poller, email_events, subscriber status updates on bounce/complaint, reconciler R1-R5.
7. **Unsubscribe + Sender Test + Polish** — unsubscribe tokens/headers/footer injection, sender-test endpoint, timeline, recipient list.

Each slice: repository → service → controller → manual curl test.

---

## 11. Key SQL (Copy-Paste Ready)

**Claim one recipient**
```sql
UPDATE campaign_recipients r
SET status='ATTEMPTING', claimed_at=now(), updated_at=now()
WHERE r.id = (
  SELECT id FROM campaign_recipients
  WHERE campaign_id=:c AND batch_no=:b
    AND status IN ('QUEUED','DEFERRED')
    AND (next_attempt_at IS NULL OR next_attempt_at <= now())
  ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED)
RETURNING id, subscriber_id, attempt_count;
```

**Persist accepted**
```sql
UPDATE campaign_recipients SET status='ACCEPTED', provider_message_id=:pmid, accepted_at=now(), updated_at=now()
WHERE id=:id AND status='ATTEMPTING';
-- 0 rows => someone else changed it, do not overwrite
```

**Persist definitive transient failure**
```sql
UPDATE campaign_recipients
SET attempt_count=attempt_count+1,
    status=CASE WHEN attempt_count+1>=3 THEN 'FAILED' ELSE 'DEFERRED' END,
    failure_code=CASE WHEN attempt_count+1>=3 THEN 'MAX_ATTEMPTS' END,
    next_attempt_at=CASE attempt_count+1 WHEN 1 THEN now()+interval '1 minute' WHEN 2 THEN now()+interval '5 minutes' END,
    last_error=:err, updated_at=now()
WHERE id=:id AND status='ATTEMPTING';
```

**Stale attempting (R2)**
```sql
UPDATE campaign_recipients SET status='FAILED', failure_code='OUTCOME_UNKNOWN', last_error='worker lost', updated_at=now()
WHERE status='ATTEMPTING' AND claimed_at < now()-interval '10 minutes';
```

**Re-wake stalled (R3 candidates)**
```sql
SELECT c.id FROM campaigns c
WHERE c.status='SENDING' AND (c.send_not_before IS NULL OR c.send_not_before <= now())
  AND EXISTS (SELECT 1 FROM campaign_recipients r WHERE r.campaign_id=c.id AND r.status IN ('QUEUED','DEFERRED') AND (r.next_attempt_at IS NULL OR r.next_attempt_at <= now()))
  AND NOT EXISTS (SELECT 1 FROM campaign_recipients r WHERE r.campaign_id=c.id AND r.updated_at > now()-interval '60 seconds')
  AND NOT EXISTS (SELECT 1 FROM outbox_events o WHERE o.aggregate_id=c.id AND o.published_at IS NULL);
-- then per campaign: SELECT DISTINCT batch_no ... LIMIT 500 -> insert outbox rows
```

**Complete (R5)**
```sql
UPDATE campaigns SET status='COMPLETED', completed_at=now(), version=version+1
WHERE status='SENDING' AND NOT EXISTS (SELECT 1 FROM campaign_recipients WHERE campaign_id=c.id AND status IN ('QUEUED','ATTEMPTING','DEFERRED'));
```

**Progress**
```sql
SELECT status, count(*) FROM campaign_recipients WHERE campaign_id=:c GROUP BY status;
SELECT count(*) FROM campaign_recipients WHERE campaign_id=:c AND status='FAILED' AND failure_code='OUTCOME_UNKNOWN';
```

**Outbox relay select**
```sql
SELECT * FROM outbox_events WHERE published_at IS NULL AND available_at <= now()
ORDER BY created_at LIMIT 200 FOR UPDATE SKIP LOCKED;
```

---

## 12. Config Properties

```
swiftkite.mail.provider=fake|smtp|ses
swiftkite.send.rate-per-second=1 (sandbox) / 14 (prod)
swiftkite.send.batch-size=25
swiftkite.send.max-attempts=3
swiftkite.send.retry-delays=1m,5m
swiftkite.send.systemic-backoff=5m
swiftkite.send.stale-attempting-after=10m
swiftkite.send.give-up-after=24h
swiftkite.reconciler.interval=30s
swiftkite.reconciler.idle-before-republish=60s
swiftkite.outbox.poll-interval=1s
swiftkite.webhook.poll-interval=5s
swiftkite.webhook.unmatched-window=10m
swiftkite.webhook.freshness=24h
swiftkite.webhook.sns-topic-arn=(required for ses)
swiftkite.subscribe.confirmation-ttl=24h
swiftkite.subscribe.resend-cooldown=5m
TOKEN_SIGNING_KEY=(required, HMAC key)
```

---

## 13. What NOT to Build in v1

- Pause, resume, cancel of SENDING campaign (adds 2 states + race conditions). Use unschedule before start.
- Retry failed button (automatic retries cover transient)
- Analytics rollups, open/click tracking, daily stats
- CSV import/export, manual add
- Segments, mailing lists inside publication, merge tags
- Separate suppression table, audit log, web archive
- Custom domains, team members, API keys, payments
- gRPC, microservices, Kafka
- User deletion, email-change verification.

Document in README: once SENDING, cannot be stopped.

---

## 14. Failure Catalogue (Implement These)

- Duplicate public subscribe → generic 200, no enumeration
- Confirmation link expired → 410, ask resubmit
- Send without sender_tested_at → 422
- Concurrent start same campaign → one wins via conditional UPDATE, other 409
- Worker crash mid-batch → message redelivered, ATTEMPTING row recovered by R2 as OUTCOME_UNKNOWN
- RabbitMQ down → outbox rows accumulate, drain when up, no loss
- Provider auth failure halfway → DEFERRED without attempt increment, send_not_before set, batch stops
- Unsubscribe after eligibility check but before provider accept → tiny residual window documented, accepted as trade-off (no design can fully close across external service)
- Webhook out-of-order (complaint after delivery) → precedence COMPLAINED > BOUNCED > DELIVERED
- Event for deleted publication → IGNORED
- Forged webhook → 403, not stored
- SNS retry after outage → 24h freshness accepts, dedupe handles repeat

---

## 15. Code Structure

```
com.swiftkite
  common (errors RFC7807, config, time)
  identity (existing auth)
  publication (entity, repo, service, dto, controller)
  subscriber (entity, repo, service, dto, controller public + auth, token service)
  campaign (entity, repo, service, dto, controller, timeline)
  delivery (batch consumer, confirmation consumer, rate limiter, reconciler, recipient repo)
  provider (EmailProvider, Fake, Smtp, Ses, exceptions)
  feedback (webhook controller, SNS verifier, inbox poller, email_events)
  messaging (outbox repo, relay, RabbitMQ config, envelope)
  entity (all entities)
  enums (all enums with canTransitionTo)
```

Rules: Module reads/writes own tables only. Controllers parse/auth/call service/shape response. No tx across provider.

---

## 16. Project Context (read first)

This document is the **single source of truth** for v1: design, build order, decisions, and repo status. The LLD at `C:\Users\hp\Downloads\SwiftKite-System-Design-LLD.md` is historical rationale; if it disagrees with this file, this file wins.

**Repo state on 2026-10-21**

- Auth is implemented end to end (`/api/auth/*`, JWT + refresh cookie, Google OAuth). Reuse it; do not rewrite or move it. Forgot/reset password, change password, and profile-name update were added on 2026-10-21.
- `V1__auth.sql` is applied; `V2__domain_schema.sql` and `V3__password_reset.sql` are written but **not applied** to any database.
- Domain entities and enums exist. There are **no repositories, services, DTOs or controllers for publications/subscribers/campaigns/delivery yet**.
- Frontend auth is wired to the real auth endpoints (axios + TanStack Query/Form); dashboard and product pages still read mock data.
- `mvn -q -DskipTests compile` passes. The app has **never been booted**: the only missing value is the local PostgreSQL password; `.env` already has a generated `JWT_SECRET_KEY` and dummy Google keys.

**Standing decisions that override this plan where they differ**

- Use the **local system PostgreSQL on port 5432**. Do not start Docker Compose for this environment.
- No API versioning. Keep paths such as `/api/auth`, `/api/publications`.
- Auth stays as-is; the Google flow is present even though it is not the current focus.
- Four campaign states only: `DRAFT, SCHEDULED, SENDING, COMPLETED`.
- No automated tests for now. Verify with compile/build and focused manual checks.
- No `subscribers.source` column and no `SubscriberSource` enum. Every signup comes from the public form, so the field carried no information.
- PostgreSQL is authoritative; state change and outbox row commit together; no DB transaction across a provider call; publication ownership is enforced in the same SQL query; no exactly-once claim; never blindly retry an ambiguous send.

**Resolved design choices**

1. **Outbox relay:** select + commit, publish outside any DB transaction, then mark published in a second transaction. Duplicate publishes are accepted.
2. **R1:** select due campaign ids without a long lock; start each in its own transaction; the conditional status update makes duplicates safe.
3. **Connection/DNS/TLS failures** are **systemic** (campaign backoff), not per-recipient attempts. Only 4xx "try later"/mailbox-full style rejections are recipient-transient.
4. **Confirm link:** `GET /api/public/confirm` performs the `PENDING → ACTIVE` transition (v1). Link prefetchers may confirm early; accepted trade-off for simplicity.
5. **`send_not_before` is per campaign** even though systemic provider errors are account-wide. Accepted v1 limitation.
6. **No unbounded retries:** ambiguous outcomes are never retried; stale `ATTEMPTING` becomes `FAILED/OUTCOME_UNKNOWN`.

---

## 17. Swagger / OpenAPI

Swagger is **already wired in the backend** (2026-10-21); keep it updated as controllers are added.

### 17.1 Dependency

```xml
<dependency>
  <groupId>org.springdoc</groupId>
  <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
  <version>3.1.1</version>
</dependency>
```

`3.1.1` is built against Spring Boot 4.1.0, matching this project's Boot 4.1.x line.

### 17.2 Endpoints

| URL | What it is |
|---|---|
| `/v3/api-docs` | OpenAPI JSON |
| `/v3/api-docs.yaml` | OpenAPI YAML |
| `/swagger-ui.html` | Swagger UI |

These paths are in `PublicPaths`, so both security and `JwtAuthenticationFilter` let them through. Disable them outside development with `SPRINGDOC_ENABLED=false`.

### 17.3 Authentication in the UI

`com.swiftkite.config.OpenApiConfig` declares the HTTP bearer scheme `bearerAuth` (format `JWT`) **and applies it globally** via `.addSecurityItem(...)`, so every operation is documented as requiring a token by default. Controllers need no security annotations.

This is the same shape as an `@OpenAPIDefinition(security = @SecurityRequirement(...))` on the application class, but with the bean doing the work.

Public endpoints opt out locally (**optional**):

- Mixed controller: `@SecurityRequirements` (empty) on each public method.
- Public-only controller: `@SecurityRequirements` on the class once.

**Repo choice (2026-10-21): no opt-outs.** The public auth methods (`sign-up`, `sign-in`, `sign-out`, `refresh-token`, `forgot-password`, `reset-password`, `oauth/exchange`) show a lock in Swagger. Accepted as a documentation-only inaccuracy; Swagger can still call them without authorizing, and runtime access is controlled by `PublicPaths`/`SecurityConfig`.

Security annotations are documentation only. Enforcement is `SecurityConfig` + `PublicPaths` + `JwtAuthenticationFilter`; keep the docs in sync with those.

### 17.4 Annotation conventions

- `@Tag(name = "...", description = "...")` on every controller.
- `@Operation(summary = "...", description = "...")` on every endpoint; summary is a short verb phrase.
- `@ApiResponse(responseCode = "404", description = "...")` for non-2xx outcomes that callers must handle: `400`, `401`, `403`, `404`, `409`, `422`, `429`.
- `@Parameter(description = "...")` for path/query parameters that are not self-explanatory.
- `@Schema(description = "...", example = "...")` on request/response DTO fields where the shape is not obvious.
- Never document or expose passwords, raw tokens, refresh cookies, `confirm_nonce`, or internal-only fields.
- Errors are RFC 7807 `application/problem+json` (`ProblemDetail`); do not invent a second error envelope for docs.

Example:

```java
@RestController
@Tag(name = "Publications", description = "Creator-owned publications")
@RequestMapping("/api/publications")
class PublicationController {

    @Operation(summary = "Create a publication")
    @ApiResponse(responseCode = "201", description = "Created")
    @ApiResponse(responseCode = "400", description = "Validation failed")
    @PostMapping
    ResponseEntity<PublicationResponse> create(@Valid @RequestBody CreatePublicationRequest request) { ... }
}
```

Because security is global, no `@SecurityRequirement` is needed above. For a public operation in the same controller:

```java
@Operation(summary = "Public publication view")
@SecurityRequirements
@GetMapping("/{publicId}/public-view")
ResponseEntity<PublicPublicationResponse> publicView(@PathVariable String publicId) { ... }
```

### 17.5 Configuration (`application.yaml`)

```yaml
springdoc:
  api-docs:
    enabled: ${SPRINGDOC_ENABLED:true}
    path: /v3/api-docs
  swagger-ui:
    enabled: ${SPRINGDOC_ENABLED:true}
    path: /swagger-ui.html
    operations-sorter: method
    tags-sorter: alpha
    display-request-duration: true
  default-produces-media-type: application/json
```

### 17.6 Acceptance checks

1. `GET /v3/api-docs` returns 200 JSON without a token.
2. `/swagger-ui.html` loads and lists the `Authentication` and `OAuth` tags.
3. Authorize with an access token, then call `GET /api/auth/me` → 200.
4. Protected endpoints show a lock. The public auth methods also show one because the repo chose no opt-outs; this is accepted.
5. No secret or token field appears in any schema.

---

## 18. Repository Map and Configuration

**Backend** (`backend/`, Spring Boot 4.1.1, Java 25, package `com.swiftkite`):

- Auth is implemented: `AuthController`, `OAuthController`, `JwtService`, `SessionCookieService`, `AuthService`, `OAuthService`, `PasswordResetService`, `PasswordResetNotifier`, `CustomUserDetailsService`, `CustomOAuth2UserService`, OAuth success/failure handlers, `JwtAuthenticationFilter`, `SecurityConfig`, `PublicPaths`, `CookieProps`, `GlobalExceptionHandler`.
- Auth endpoints: `POST /api/auth/sign-up|sign-in|sign-out|refresh-token|forgot-password|reset-password`, `GET /api/auth/me`, `PATCH /api/auth/me`, `POST /api/auth/password`, `POST /api/auth/password/change`, `POST /api/auth/oauth/exchange`, `GET /api/auth/providers/link-token`, `GET /api/auth/providers`, `DELETE /api/auth/providers/{provider}`.
- Password reset: `PasswordResetToken` entity + repository; `V3__password_reset.sql`; SHA-256 token hash at rest, one active token per user, 30-minute default TTL. `PasswordResetNotifier` logs the link until the email provider exists.
- Domain entities: `Publication`, `Subscriber`, `Campaign`, `CampaignRecipient`, `CampaignTimeline`, `WebhookInbox`, `EmailEvent`, `OutboxEvent`.
- Domain enums: `CampaignStatus`, `SubscriberStatus`, `RecipientStatus`, `SkipReason`, `FailureCode`, `Provider`, `EmailEventType`, `WebhookInboxStatus`, `RoleName`, `AuthProvider`. `SubscriberSource` was deleted on 2026-10-21.
- No publication/subscriber/campaign/delivery repository, service, DTO or controller exists yet.

**Migrations**

- `V1__auth.sql` creates `users`, `roles` (seeds `CREATOR`), `user_roles`, `user_identity`, `refresh_token`, `oauth_login_code`.
- `V2__domain_schema.sql` creates `publications`, `subscribers`, `campaigns`, `campaign_recipients`, `campaign_timeline`, `webhook_inbox`, `email_events`, `outbox_events`. **Not applied.**
- `V3__password_reset.sql` creates `password_reset_token` (`user_id` unique, `token_hash` unique, `expires_at`). **Not applied.**
- `ddl-auto: validate`; Flyway is the only schema writer.

**Config**

- `application.yaml`: DB `jdbc:postgresql://localhost:5432/swiftkite`; RabbitMQ `localhost:5672`; refresh cookie `sk_refresh` (`SameSite=Lax`, `secure=false` locally); access JWT 15 min; refresh JWT 30 d; 30 s refresh-reuse grace; reset-token TTL 30 min (`RESET_TOKEN_EXPIRY_MINUTES`); OAuth callback `/auth/callback`.
- `spring.config.import: optional:file:.env[.properties]` loads `backend/.env` when launched from `backend/`.
- `backend/.env` (gitignored) has all current variables: `DATABASE_*`, `RABBITMQ_*`, `JWT_SECRET_KEY`, JWT lifetimes, dummy `GOOGLE_CLIENT_*`, `FRONTEND_URL`, `COOKIE_*`, `RESET_TOKEN_EXPIRY_MINUTES`, `SPRINGDOC_ENABLED`, plus a generated `TOKEN_SIGNING_KEY` and commented planned mail/delivery properties.
- `backend/.env.example` mirrors it with placeholders.
- Swagger: `/swagger-ui.html`, `/v3/api-docs`; disable with `SPRINGDOC_ENABLED=false`.

**Frontend** (`frontend/`)

- Next.js 16.4.2 App Router, React 19, TypeScript, Tailwind, shadcn/ui, Recharts.
- **Auth is real (2026-10-21).** Product/dashboard pages still read `src/data/mock.ts`; do not treat them as an API contract.
- Transport: one axios instance in `src/lib/axiosInstance.ts` (`withCredentials`), in-memory access token, httpOnly `sk_refresh` cookie, single-flight refresh on 401, RFC 7807 `ProblemDetail` → `ApiError`.
- Data/forms: TanStack Query owns session bootstrap, `/me`, providers, and auth mutations; TanStack Form owns sign-in, sign-up, forgot/reset password, profile edit, and set/change password. Defaults live in `src/lib/query-client.ts`.
- Auth modules: `src/lib/auth.tsx` (`AuthProvider`, `useAuth`), `src/lib/auth-api.ts`, `src/lib/auth-schemas.ts`, `src/lib/validation.ts`, `src/lib/errorHandler.ts`, `src/lib/query-keys.ts`.
- Routes: `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password?token=...`, `/auth/callback`; the dashboard guard is `src/components/newsflow/require-auth.tsx`.
- UI: auth screens in `src/components/newsflow/auth.tsx`; profile/security in `settings.tsx`; shared TanStack Form inputs in `src/components/ui/custom-form.tsx` (`FormFieldWrapper`, `FormPasswordFieldWrapper` with show/hide + strength).
- Feedback: errors and successes are Sonner toasts (`errorHandler`, `toastFormError`); no inline form errors. The Toaster follows the app light/dark/system theme.
- Account UI: real profile-name save (`PATCH /api/auth/me`), set password, change password, and provider link/unlink. Email editing and account deletion are unavailable.
- Sign-up no longer shows the unbacked Terms checkbox. Password/name validation mirrors `PasswordPolicy` (6+ chars, upper/lower/digit/special, no whitespace; names ≤100).
- Password reset uses a single-use link. The backend logs the URL through `PasswordResetNotifier` until the email provider lands; the API never returns the reset URL. No `expose-reset-token` switch exists.
- Route rename: `/login` → `/sign-in`, `/signup` → `/sign-up`; copy uses "Sign in"/"Sign up".
- Dependencies added: `axios`, `@tanstack/react-form` (TanStack Query was already installed).

**Blockers**

1. The local 5432 PostgreSQL password is unknown. `backend/.env` currently guesses `swiftkite`.
2. The app needs `JWT_SECRET_KEY` (generated in `.env`) and Google keys (dummy values in `.env` are enough to boot).
3. Local RabbitMQ and Mailpit availability is unconfirmed.
4. V2 and V3 have never been applied, so `ddl-auto: validate` and every mapping risk (JSONB, CITEXT, text IP) are unverified.

**Next step**

Apply V2/V3 on 5432 and boot the real app to verify `ddl-auto: validate`, then build the publication slice (§10 step 1).

---

## 19. Gotchas

- Boot 4 test dependencies are named `spring-boot-starter-*-test`; do not "fix" them to the Boot 3 layout.
- App code uses Jackson 3 (`tools.jackson`). jjwt 0.13.0 pulls Jackson 2 at runtime only — expected.
- Ignore `docker-compose.yml` and its 5433 Postgres. Use the local system Postgres on 5432.
- `oauth2Login` is unconditional. The app will not boot without `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (dummy values are in `.env`).
- The dashboard/product pages still look complete because of mock data. Auth is real; check `src/data/mock.ts` usage before assuming a product screen is wired.
- Password reset has no email provider yet: `PasswordResetNotifier` logs the link. Do not add a reset URL to the API response.
- `JWT_SECRET_KEY` must stay empty in `application.yaml` (`${JWT_SECRET_KEY:}`) and come from `.env`; never commit a default secret.
- `frontend/AGENTS.md` holds Next.js conventions.
- No tests exist on purpose. Do not add test sources unless asked.
- `V1__auth.sql` has `UNIQUE(user_id)` on `refresh_token` (one lineage per user). Per-device sessions need a later auth migration; not part of V2.
- JSONB is mapped as `String` + `@JdbcTypeCode(SqlTypes.JSON)`; CITEXT as `String`; IPs as text. If Hibernate `validate` rejects a mapping, fall back to `JsonNode`, lowercased email + unique index, or validated string IPs.
- `WebhookInboxStatus` is the only inbox/outbox enum. The outbox has **no status enum**: `published_at IS NULL` = pending; `available_at` is the backoff clock.
- Never edit an applied migration. V2 and V3 are still safe to edit in place.

---

## 20. Decision Log (current)

Older decisions that this section replaced were removed on 2026-10-21 to keep one source of truth; git history retains them.

- **2026-10-16 — Auth stack.** JWT access token (15 min) in the body/`Authorization` header; rotating refresh JWT (30 d) in an HttpOnly `SameSite=Lax` cookie; hashes at rest; 30 s reuse grace. Google OAuth is mandatory in v1. RFC 7807 errors. Lombok `@Getter/@Setter` on entities, `@Data` on DTOs. No tests until asked.
- **2026-10-19 — Ownership and deletion.** Publications are hard-deleted (cascade), guarded while a campaign is `SENDING`. Subscribers are soft-deleted via `deleted_at` and keep their lifecycle status. No ShedLock/advisory locks: jobs are set-based. Late-event precedence `COMPLAINED > BOUNCED > DELIVERED > ACCEPTED`. Retry is 3 total attempts (+1m, +5m, then `FAILED/MAX_ATTEMPTS`).
- **2026-10-21 — v1 simplification.** Four campaign states (`DRAFT, SCHEDULED, SENDING, COMPLETED`); no pause/cancel/resume. No suppression/audit/daily-stats tables; `subscribers.status` is the suppression truth and hard bounce is per publication. Confirmation tokens are HMAC-signed with `confirm_nonce` stored. `sender_tested_at` gates sending. `send_not_before` is the systemic backoff. Recipients require `subscriber_id`. `email_events` uses five types, `Provider.SYSTEM`, and mandatory `publication_id`/`subscriber_id`.
- **2026-10-21 — No subscriber source.** `SubscriberSource`, `subscribers.source` and `subscribers.source_tag` were removed: every signup comes from the public form and the tags added no information.
- **2026-10-21 — Outbox has no status enum.** `published_at IS NULL` means pending; `attempts`, `last_error`, `available_at` cover retry/backoff.
- **2026-10-21 — Delivery boundaries.** Outbox publishes outside a DB transaction; R1 starts campaigns in their own transactions; connection/DNS/TLS failures are systemic, not per-recipient attempts; ambiguous sends are never retried.
- **2026-10-21 — Swagger.** springdoc 3.1.1, global `bearerAuth` requirement, no controller security annotations; docs are public and disabled with `SPRINGDOC_ENABLED=false` outside dev.
- **2026-10-21 — Frontend auth transport.** One axios instance (`src/lib/axiosInstance.ts`) for auth/account calls; access token memory-only, refresh token httpOnly, single-flight 401 refresh; TanStack Query for session/providers and TanStack Form for auth/account forms. No per-page fetch wrappers.
- **2026-10-21 — Password reset.** Email-link flow with a single-use SHA-256-hashed token (30 min), generic forgot response, and all sessions revoked on reset. No `expose-reset-token` and no reset URL in responses; delivery is a notifier seam until the email provider lands.
- **2026-10-21 — Auth UI.** `/sign-in` and `/sign-up` route names; toast-only errors/successes via a themed Sonner Toaster; custom TanStack Form field wrappers (including password reveal + strength); profile name, set/change password, and provider link/unlink wired to real endpoints. No Terms checkbox.
- **2026-10-21 — One document.** This file is the single source of truth. The LLD and the old standalone plan are historical.

---

## 21. Change Log

- **2026-10-19 — Auth end to end.** Existing auth/JWT/OAuth code verified in the repo; `V1__auth.sql` applied.
- **2026-10-19 — Domain model added (compile only).** Eight entities and the enums written; no repositories/services/controllers; V2 written but not applied.
- **2026-10-21 — V2 and entities aligned with the v1 LLD.** Added `sender_tested_at`, `confirm_nonce`, `send_not_before`, `EXPIRED`, `Provider.SYSTEM`, `email_events.subscriber_id`; removed suppression/audit/daily-stats and `claimed_by`; recipient `subscriber_id` is NOT NULL; `canTransitionTo` added to the state enums. `mvn -q -DskipTests compile` passes.
- **2026-10-21 — Swagger wired.** springdoc 3.1.1, global JWT scheme, docs paths public, `@Tag` on existing controllers. Zero security annotations by choice.
- **2026-10-21 — `backend/.env` created.** All current variables, generated JWT/token keys, dummy Google keys, auto-load via `spring.config.import`; `.env.example` updated; DB default corrected to 5432.
- **2026-10-21 — `SubscriberSource` removed.** `subscribers.source` and `subscribers.source_tag` dropped from V2 and the entity; enum deleted.
- **2026-10-21 — Docs merged.** `SwiftKite-Implementation-Plan.md` folded into this file; contradictions resolved (outbox tx, R1, DNS classification, confirm GET, per-campaign backoff, Docker Compose).
- **2026-10-21 — Enum audit.** All domain enums kept: each encodes a distinct axis or terminal state. Removed the unused `unsubscribe_reason` column; `duplicated_from_id` is used by the duplicate-campaign endpoint. No unused Java files found.
- **2026-10-21 — Frontend auth integrated.** Added the axios instance, TanStack Query session/providers, TanStack Form auth/account forms, auth context/bootstrap, OAuth callback exchange, route guard, profile/password settings, Google link/unlink, and toast feedback. Renamed `/login`/`/signup` to `/sign-in`/`/sign-up`.
- **2026-10-21 — Account + reset endpoints.** Added `PATCH /api/auth/me`, `POST /api/auth/password/change`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `password_reset_token` (V3), and the notifier seam. Forgot returns a generic message; reset returns a success message. Neither exposes the reset URL.

**Verification state:** `mvn -q -DskipTests compile` and `mvn -q clean package -DskipTests` pass. In `frontend/`, `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass. No migration has been applied; the app has never been booted; no API or Swagger request has been made.
