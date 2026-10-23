# SwiftKite

SwiftKite is an email campaign delivery platform. A user writes a campaign
template, adds recipients with per-recipient placeholder values, previews the
rendered result, sends the campaign, and then watches each delivery settle
independently as the provider reports delivered / bounced / complained.

The send itself is a durable, transactional hand-off: the API writes delivery
rows and an outbox record in one transaction, a relay wakes a RabbitMQ consumer,
and an at-most-once worker pool calls the email provider. PostgreSQL â€” not the
queue â€” is the source of truth, so a lost or duplicated wake-up message is
harmless.

## Contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Templates and placeholders](#templates-and-placeholders)
- [API reference](#api-reference)
- [Reliability notes](#reliability-notes)
- [Known limitations](#known-limitations)

## What it does

- User-scoped campaign CRUD with HTML subject/body templates and a preview text.
- Per-recipient placeholder values with rendered previews before sending.
- Recipient editing at every level: add a batch, edit one row, delete one row,
  rename a column across all recipients, or remove a column.
- Transactional Send: delivery snapshots and outbox rows in a single transaction.
- RabbitMQ wake-up messages backed by a transactional outbox and a dead-letter queue.
- At-most-once worker sends using `SELECT ... FOR UPDATE SKIP LOCKED` claims.
- Campaign pause / resume / stop / delete with explicit state transitions.
- Provider-level system pause on auth errors (`PROVIDER`) or rate limits (`RATE_LIMITED`).
- Stuck-worker reaping and completion / stop reconciliation.
- Resend webhooks with Svix signature verification and inbox deduplication.
- Out-of-order webhook protection and `OUTCOME_UNKNOWN` repair by delivery id.
- Next.js dashboard: campaign list, draft editor, recipient table, delivery progress,
  settings, and the full auth flow (sign-up, sign-in, Google OAuth, password reset).

## Architecture

End-to-end flow, from a click in the browser to a delivered email:

```text
Browser
  |  REST + JWT (Bearer access token, HttpOnly refresh cookie)
  v
Next.js dashboard  (:3000)
  |
  v
SwiftKite API  (:8080)
  |  Send = one transaction: delivery snapshots + outbox rows
  v
PostgreSQL  --outbox-->  OutboxRelay  --wake-up-->  RabbitMQ (+ DLQ)
  ^                                                      |
  |                                                      v
  |                                          CampaignSendListener
  |                                                      |
  |                                                      v
  |  claim rows (SKIP LOCKED) <---------------- CampaignSendWorker
  |                                                      |
  |                                                      v
  |                                        EmailProvider (Resend)
  |                                                      |
  |                                                      v
  |                                        DeliveryOutcomeService
  |                                  (pause / completion / repair)
  |                                                      |
  +------------------------------------------------------+

Resend --(webhook, Svix signature)--> POST /api/webhooks/email --> repair delivery
```

The queue only carries a wake-up signal. Workers claim rows from
`notification_deliveries`, commit the claim, then call the provider outside the
database transaction. When there are no claimable rows left the workers simply
stop, so duplicate wake-ups are safe. Delivery status flows back into the same
PostgreSQL tables, which is why the dashboard can poll a campaign's progress and
the webhook can repair a delivery without ever touching the queue.

### Delivery lifecycle

```text
PENDING -> ATTEMPTING -> ACCEPTED -> DELIVERED
                      \-> FAILED (PROVIDER_REJECTED | OUTCOME_UNKNOWN)
ACCEPTED -> BOUNCED | COMPLAINED        (webhook)
PENDING  -> CANCELLED                   (Stop)
ATTEMPTING -> PENDING                   (system pause: 401 / 403 / 429)
```

Webhook statuses never move backwards:

```text
ACCEPTED < DELIVERED < BOUNCED < COMPLAINED
```

A `FAILED / OUTCOME_UNKNOWN` delivery can be repaired by a later webhook;
`FAILED / PROVIDER_REJECTED` is terminal.

### Campaign lifecycle

```text
DRAFT -> SENDING -> COMPLETED
            |  ^
       pause|  |resume
            v  |
          PAUSED
            |
          stop
            v
         STOPPING -> STOPPED
```

Pause leaves `PENDING` deliveries untouched. Stop cancels them. In-flight sends
finish, and the reconciler finalizes `STOPPING -> STOPPED` once the last
`ATTEMPTING` row resolves.

## Tech stack

**Backend**

- Java 25, Spring Boot 4.1.1
- Spring Web MVC, Spring Security + JWT (access token + HttpOnly refresh cookie), Google OAuth
- Spring Data JPA and JdbcTemplate, PostgreSQL 17, Flyway
- Spring AMQP / RabbitMQ (transactional outbox + dead-letter queue)
- Jackson 3 (`tools.jackson`), Lombok
- Resend as the email provider, behind an `EmailProvider` interface
- springdoc / OpenAPI

**Frontend**

- Next.js 16 (App Router, Turbopack) and React 19
- TanStack Query for server state, TanStack Form + Zod for forms
- Tailwind CSS 4 and Radix UI primitives
- Textarea-based template editors with placeholder chips and a live rendered preview

## Repository layout

```text
backend/                     Spring Boot API (base package com.swiftkite)
  src/main/java/com/swiftkite/
    config/                  security, CORS, RabbitMQ, scheduling, public paths
    controller/              REST endpoints
    dto/<domain>/            request/response DTOs, shared wrappers in dto/common
    entity/                  JPA entities
    enums/                   campaign status, delivery status, failure code, ...
    exception/               domain exceptions + GlobalExceptionHandler
    filter/                  JWT authentication filter
    provider/                EmailProvider abstraction + Resend implementation
    repository/              Spring Data repositories and JdbcTemplate queries
    security/                JWT service, OAuth handlers, cookie handling
    services/                interfaces/ + implementation/
    util/                    PlaceholderExtractor, TemplateRenderer, Pagination
    validation/              custom validators
  src/main/resources/
    application.yaml         every setting is ${ENV_VAR}; there are no inline defaults
    db/migration/V1__init.sql Flyway schema

frontend/                    Next.js App Router UI
  src/app/                   routes: landing, sign-in/up, password reset, dashboard
  src/components/swiftkite/  feature components (campaigns, editor, settings, shell)
  src/hooks/                 TanStack Query hooks
  src/lib/                   API clients, types, auth context, validation, error handling

docker-compose.yml           full stack: postgres, rabbitmq, backend, frontend
.env.example                 single environment template for compose
```

## Getting started

Prerequisites: Docker.

### Run the full stack

1. Create the single environment file and fill in the secrets:

   ```bash
   cp .env.example .env
   ```

   Set at least `JWT_SECRET_KEY`, `RESEND_API_KEY` and `RESEND_WEBHOOK_SECRET`.
   Every `${VAR}` in `docker-compose.yml` is read from this file and has **no
   fallback default**, so a missing value fails fast instead of silently using a
   placeholder.

2. Build and start the stack:

   ```bash
   docker compose up --build
   ```

   | Service             | URL                                                              |
   | ------------------- | ---------------------------------------------------------------- |
   | Frontend            | http://localhost:3000                                            |
   | API                 | http://localhost:8080 (Swagger UI when `SPRINGDOC_ENABLED=true`) |
   | RabbitMQ management | http://localhost:15672                                           |
   | PostgreSQL          | `localhost:5432` (`POSTGRES_PORT`)                               |

   Flyway applies `db/migration/V1__init.sql` when the backend starts.

## Configuration

The root `.env` must define every variable referenced by `application.yaml`:

| Variable                                                                               | Purpose                                                  |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`                               | PostgreSQL connection                                    |
| `JWT_SECRET_KEY`, `JWT_ACCESS_EXPIRATION_MS`, `JWT_REFRESH_EXPIRATION_MS`              | JWT auth                                                 |
| `COOKIE_SECURE`, `COOKIE_MAX_AGE`                                                      | Refresh cookie                                           |
| `FRONTEND_URL`                                                                         | CORS allow-list and OAuth redirect target                |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                             | Google OAuth                                             |
| `RESEND_API_KEY`, `RESEND_BASE_URL`                                                    | Resend provider                                          |
| `MAIL_SYSTEM_FROM_NAME`, `MAIL_SYSTEM_FROM_EMAIL`                                      | System sender (account mail and default campaign sender) |
| `RESEND_WEBHOOK_SECRET`                                                                | Svix/Resend webhook signature                            |
| `RESEND_WEBHOOK_TOLERANCE_SECONDS`                                                     | Webhook timestamp tolerance (seconds)                    |
| `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD`             | RabbitMQ                                                 |
| `WORKER_CONCURRENCY`, `WORKER_PREFETCH`                                                | Worker listener settings                                 |
| `OUTBOX_RELAY_DELAY_MS`, `OUTBOX_INITIAL_DELAY_MS`, `OUTBOX_BATCH_SIZE`                | Outbox relay                                             |
| `RECONCILER_DELAY_MS`, `RECONCILER_INITIAL_DELAY_MS`, `RECONCILER_STUCK_AFTER_MINUTES` | Reconciler                                               |
| `SCHEDULER_POOL_SIZE`                                                                  | Outbox/reconciler scheduler threads                      |
| `RESET_TOKEN_EXPIRY_MINUTES`, `SPRINGDOC_ENABLED`                                      | Password reset, API docs                                 |

Conventions:

- **No inline defaults.** Every variable referenced by `application.yaml` has to
  be present; the YAML never falls back to a hard-coded value.
- **The sender address is not user input.** SwiftKite sends through its own
  Resend account, so the campaign `from` address always comes from
  `MAIL_SYSTEM_FROM_EMAIL` and is stored on the campaign. `CampaignWriteRequest`
  deliberately has no `fromEmail`. Only the sender **display name** is editable
  per campaign.
- **Resend requires a verified sending domain.** The `MAIL_SYSTEM_FROM_EMAIL`
  domain must be verified in the Resend account, otherwise sends are rejected
  and the campaign is paused with `PROVIDER`.

## Templates and placeholders

Subject and body templates use `{{ key }}` placeholders:

- A key is one or more word characters: `[A-Za-z0-9_]`.
- Whitespace inside the braces is allowed (`{{ name }}` is the same as `{{name}}`).
- An **empty** placeholder â€” `{{}}` or `{{   }}` â€” is rejected with `400` on
  create, update and send, because it can never render to anything meaningful.
- Values are substituted per recipient from that recipient's `data` map.
- Before a campaign sends, every placeholder is checked against every recipient.
  If a key has no value the send fails with `400` (listing the affected
  recipients and keys) and the campaign stays `DRAFT` â€” a placeholder is never
  silently rendered empty.
- Removing a column can optionally strip the matching `{{ placeholder }}` from
  the subject and body, so the two stay consistent.

`POST /api/campaigns/{id}/preview` renders the current subject/body against an
inline `data` map so the editor can show the result without sending anything.

## API reference

All endpoints except the public ones below require `Authorization: Bearer <accessToken>`.
Errors are returned as RFC 7807 `ProblemDetail`.

### Auth

```text
POST   /api/auth/sign-up
POST   /api/auth/sign-in
POST   /api/auth/refresh-token
POST   /api/auth/sign-out
GET    /api/auth/me
PATCH  /api/auth/me                 # update display name
POST   /api/auth/password           # set a password on an OAuth-only account
POST   /api/auth/password/change    # change an existing password
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
POST   /api/auth/oauth/exchange
GET    /api/auth/providers
GET    /api/auth/providers/link-token
DELETE /api/auth/providers/{provider}
```

### Campaigns

```text
POST   /api/campaigns               -> 201 { campaign }
GET    /api/campaigns?page&size     -> page of campaign summaries
GET    /api/campaigns/defaults      -> { fromEmail, fromName }   (editor default sender)
GET    /api/campaigns/{id}          -> campaign detail
PUT    /api/campaigns/{id}          -> campaign                  (DRAFT only)
POST   /api/campaigns/{id}/send     -> 202 { id, status, recipients }
POST   /api/campaigns/{id}/pause    -> campaign
POST   /api/campaigns/{id}/resume   -> campaign
POST   /api/campaigns/{id}/stop     -> campaign
DELETE /api/campaigns/{id}          -> 204
```

Create / update body (note there is no `fromEmail`):

```json
{
  "name": "October launch",
  "subjectTemplate": "Hi {{ name }}",
  "previewText": "A short teaser",
  "bodyTemplate": "<p>Hello {{ name }}, welcome to {{ company }}.</p>",
  "fromName": "SwiftKite"
}
```

### Recipients

```text
POST   /api/campaigns/{id}/recipients                 -> 201 { inserted, skipped }
GET    /api/campaigns/{id}/recipients?page&size       -> page of recipients
PUT    /api/campaigns/{id}/recipients/{recipientId}   -> recipient
DELETE /api/campaigns/{id}/recipients/{recipientId}   -> 204
POST   /api/campaigns/{id}/recipients/fields/rename   -> { updated }
POST   /api/campaigns/{id}/recipients/fields/remove   -> { updated }
POST   /api/campaigns/{id}/preview                    -> { subject, body }
```

Add (max 500 recipients per call, duplicates are skipped):

```json
{
  "recipients": [{ "email": "asha@acme.test", "data": { "name": "Asha", "company": "Acme" } }]
}
```

Field edits operate across every recipient:

```json
// rename a column (moves "name" to "fullName", dropping the old key)
{ "from": "name", "to": "fullName", "overwrite": false }

// remove one or more columns
{ "keys": ["company", "old_field"] }
```

### Deliveries

```text
GET /api/campaigns/{id}/deliveries?status&page&size
```

Optional `status` filters by delivery status (`PENDING`, `ATTEMPTING`, `ACCEPTED`,
`DELIVERED`, `BOUNCED`, `COMPLAINED`, `FAILED`, `CANCELLED`).

### Webhook

```text
POST /api/webhooks/email
```

Public and provider-agnostic in shape. It verifies Resend's Svix-style signature,
deduplicates by `svix-id`, and returns `200` for accepted, duplicate and ignored
events. Handled types: `email.delivered`, `email.bounced`, `email.complained`.
Other event types are recorded and ignored.

## Reliability notes

- **Transactional outbox:** Send writes deliveries and outbox rows in one
  transaction. The relay only marks a row published after RabbitMQ confirms it,
  so duplicate wake-up messages are safe.
- **At-most-once sends:** a worker claims one row with `FOR UPDATE SKIP LOCKED`,
  commits the claim, then calls the provider outside the database transaction. If
  the process dies mid-send the row stays `ATTEMPTING`; the reaper marks it
  `FAILED / OUTCOME_UNKNOWN` after the configured timeout. It is never retried
  automatically.
- **System pause:** a provider auth error pauses the campaign with `PROVIDER`; a
  rate limit pauses it with `RATE_LIMITED`. The affected delivery returns to
  `PENDING` so a manual Resume can retry it.
- **Stop race:** if a system failure arrives after a Stop, the in-flight delivery
  is cancelled instead of being returned to `PENDING`.
- **Webhook repair:** campaign sends include an `X-SwiftKite-Delivery-Id` header
  and a `delivery_id` tag, so a webhook can repair a delivery even when no
  `provider_message_id` was stored (for example after a crash).

## Known limitations

- **Sending is immediate.** There is no schedule-for-later; a campaign sends as
  soon as it is submitted.
- **At-most-once sends.** A crash after the provider accepts but before the
  database write leaves a delivery `OUTCOME_UNKNOWN`, with no automatic retry
  and no attempt history.
- **Delivery state can stall.** Only `email.delivered`, `email.bounced` and
  `email.complained` webhooks are handled, so a delivery may stay `ACCEPTED`
  forever, and provider-side failures or suppressions are not reflected.
- **Recovery is manual.** A system pause (`PROVIDER` / `RATE_LIMITED`) never
  auto-resumes, and a delivery with no correlation id cannot be repaired by a
  webhook.
- **One sender identity.** The from address is fixed by
  `MAIL_SYSTEM_FROM_EMAIL` (its domain must be verified in Resend); only the
  display name is editable per campaign.
- **Single role.** Every account is a `CREATOR` — there are no teams, shared
  workspaces or granular permissions.
- **The sign-in email cannot be changed yet** — there is no verification flow.
- **Template HTML is trusted.** The creator's markup is stored and sent as-is;
  placeholder values are HTML-escaped, but the template itself is not sanitised.
- **Hard delete.** Deleting a campaign is immediate and cascades to its
  recipients and deliveries.
- **No automated tests.** Verification is manual for now.
