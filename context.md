# Newsletter SaaS (Beehiiv-style MVP): Project Context

> **Purpose of this file:** Context for a local LLM coding assistant. Read it fully before suggesting code or architecture. Follow the decisions here unless the developer explicitly changes them.

---

## 1. Project summary

A **multi-tenant newsletter platform**. A creator signs up, creates one or more **publications**, embeds a subscribe form on their own website (using a public **Publication ID**), writes **campaigns**, and sends them to subscribers through an email provider. The system tracks delivery, bounces, complaints, unsubscribes, and basic engagement.

**Primary goal:** a strong **resume/portfolio project** that can grow into a real SaaS. It must demonstrate backend engineering depth (correctness under failure), not feature count.

**Guiding principle:** a small system that is _clearly correct under failure_ beats a large system that is mediocre everywhere.

---

## 2. Scope

### In scope (v1)

- Creator auth (signup, login, logout) and dashboard
- Multiple publications per creator
- Public subscribe endpoint using Publication ID, with double opt-in
- Subscriber lifecycle and consent/source tracking
- Campaign creation, preview, test send, schedule, send, pause, resume
- Queue-based sending with per-recipient state, idempotency, retries, dead-letter handling
- Email provider interface (Fake/Mailpit locally, Amazon SES for real sending)
- Provider webhook ingestion (delivered, bounce, complaint) with signature verification and duplicate/out-of-order safety
- One-click unsubscribe (RFC 8058 headers) and suppression checks before every send
- Analytics from PostgreSQL event tables plus daily rollups
- Hosted public pages: confirm subscription, unsubscribe, optional web archive of issues
- Light/dark theming
- Tests (unit, integration with Testcontainers, load test), CI, observability basics, README with diagrams and design decisions

### Out of scope (v1): do NOT build or suggest unless asked

- **API keys** (explicitly deferred to future work)
- Payments / paid tiers / Stripe
- Podcasts, community, website builder, ad network, referral network
- AI writer / AI images / MCP server
- Real-time collaborative editing
- Automations / drip sequences, A/B testing, segments beyond simple status filters
- IP warming, blocklist monitoring, feedback-loop registration (mention as future work in README)
- Kafka (see ADR-001)

---

## 3. Tech stack (locked)

| Layer            | Choice                                                                                                                            | Notes                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Frontend         | **Next.js (App Router) + React + TypeScript + Tailwind**                                                                          | shadcn/ui, TanStack Query, Recharts, TipTap, next-themes             |
| Backend          | **Spring Boot (Java 21+)**                                                                                                        | REST API, Spring Security, Spring AMQP, Spring Data JPA/JDBC, Flyway |
| Database         | **PostgreSQL**                                                                                                                    | Source of truth for everything, including events at first            |
| Queue            | **RabbitMQ**                                                                                                                      | Task queue for sending, retries, DLQ                                 |
| Local mail inbox | **Mailpit** (SMTP :1025, UI :8025; dev only, SES is prod-only)                                                                    | Catches outgoing mail locally; no paid accounts needed               |
| Email            | **Provider interface** with implementations: `FakeEmailProvider` (tests), `SmtpEmailProvider` (Mailpit, local dev default), `SesEmailProvider` (production only) | JavaMail SMTP for Mailpit/SES; SES starts in sandbox; needs production-access request |
| Object storage   | MinIO (optional, only for images/attachments if added)                                                                            | Not required for core v1                                             |
| Observability    | Spring Actuator + Micrometer, Prometheus + Grafana                                                                                | Queue depth, send rate, failures                                     |
| Testing          | JUnit 5, Testcontainers (Postgres, RabbitMQ), k6 or Gatling                                                                       |                                                                      |
| CI               | GitHub Actions                                                                                                                    | Build, test, lint                                                    |
| Deployment       | Docker Compose (local and single VPS)                                                                                             | Frontend on Cloudflare Pages/Vercel optionally                       |

---

## 4. Architecture

```
                 ┌────────────────────────────┐
                 │  Next.js (dashboard +      │
                 │  public pages)             │
                 └─────────────┬──────────────┘
                               │ REST (JWT/cookie)
Creator's website              ▼
  <form> ───────────►  ┌──────────────────┐        ┌──────────────┐
  (Publication ID)     │  Spring Boot API │◄──────►│  PostgreSQL  │
                       │  (web + admin)   │        │  (+ outbox)  │
                       └───────┬──────────┘        └──────▲───────┘
                               │ outbox relay             │
                               ▼                          │
                       ┌──────────────┐   consume   ┌─────┴────────┐
                       │  RabbitMQ    │────────────►│  Send Workers│
                       └──────────────┘             └─────┬────────┘
                                                          │ EmailProvider interface
                                                          ▼
                                              Fake / Mailpit / Amazon SES
                                                          │
                                            delivery/bounce/complaint events
                                                          ▼
                                       Webhook endpoint (verify signature) ─► Postgres
```

**Deployable units:** `api` (web) and `worker` (queue consumers) can be the same Spring Boot codebase started with different profiles, so workers scale independently.

### Key patterns

1. **Transactional outbox:** when a campaign is started, write the campaign state change _and_ an outbox row in the same DB transaction. A relay process publishes outbox rows to RabbitMQ and marks them published. This prevents DB/queue drift.
2. **Per-recipient state machine:** campaign state is separate from recipient state. Recovery after crash uses recipient rows, not a campaign flag.
3. **Idempotent sends:** unique constraint `(campaign_id, subscriber_id)` on `campaign_recipients`. Workers claim a recipient with a conditional update (`WHERE status = 'QUEUED'`). A redelivered message must never cause a second email.
4. **Provider abstraction:** all sending goes through `EmailProvider`. Business logic never imports SES SDK classes directly.
5. **Webhook safety:** verify signature, dedupe by provider event ID, tolerate out-of-order events (never move a terminal state backward).

---

## 5. Domain model

### Entities

- **User** (creator account)
- **Publication** (owned by User; has public ID like `pub_8f3k2j`)
- **Subscriber** (belongs to one Publication; unique `(publication_id, email)`)
- **Campaign** (belongs to Publication)
- **CampaignRecipient** (Campaign × Subscriber; delivery state)
- **EmailEvent** (provider and tracking events)
- **Suppression** (global and per-publication)
- **OutboxEvent**
- **ConsentRecord** (could be columns on Subscriber in v1)
- **DailyCampaignStats** (rollup)

### Suggested schema (PostgreSQL, adapt via Flyway migrations)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email CITEXT UNIQUE NOT NULL,
  password_hash TEXT,                       -- NULL for OAuth-only accounts
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_account_non_locked BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id UUID PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,                -- v1: single 'CREATOR' row, seeded by migration
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  UNIQUE (user_id, role_id)
);

-- One row per credential. A user may hold several (account linking); at
-- least one credential must always remain (enforced in code).
CREATE TABLE user_identity (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,                   -- LOCAL | GOOGLE
  provider_id TEXT,                         -- NULL for LOCAL (password has no external subject)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_id),
  UNIQUE (user_id, provider)
);

-- One active refresh lineage per user. Rotation keeps the previous token
-- hash for a short grace window (concurrent-retry safe); presenting a stale
-- token after the window revokes the lineage (reuse detection, RFC 9700 4.14.2).
CREATE TABLE refresh_token (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,                 -- SHA-256 hex, never the raw token
  previous_token_hash TEXT,
  previous_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Single-use OAuth login codes bridging the provider redirect and the
-- frontend token exchange. Never stores tokens.
CREATE TABLE oauth_login_code (
  id UUID PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL until first login
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  expires_at TIMESTAMPTZ NOT NULL,          -- ~5 minutes
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

CREATE TABLE publications (
  id UUID PRIMARY KEY,
  public_id TEXT UNIQUE NOT NULL,          -- e.g. pub_8f3k2j (non-secret)
  owner_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,                -- must be a verified sender
  reply_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscribers (
  id UUID PRIMARY KEY,
  publication_id UUID NOT NULL REFERENCES publications(id),
  email CITEXT NOT NULL,
  status TEXT NOT NULL,                    -- PENDING|ACTIVE|UNSUBSCRIBED|BOUNCED|COMPLAINED
  source TEXT,                             -- form/site tag
  consent_at TIMESTAMPTZ,
  consent_ip INET,
  confirm_token_hash TEXT,
  confirmed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (publication_id, email)
);
CREATE INDEX ON subscribers (publication_id, status);

CREATE TABLE campaigns (
  id UUID PRIMARY KEY,
  publication_id UUID NOT NULL REFERENCES publications(id),
  subject TEXT NOT NULL,
  content_json JSONB,                      -- editor document
  content_html TEXT,                       -- rendered email-safe HTML
  status TEXT NOT NULL,                    -- DRAFT|SCHEDULED|SENDING|PAUSED|COMPLETED|FAILED|CANCELLED
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  audience_count INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE campaign_recipients (
  id UUID PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  subscriber_id UUID NOT NULL REFERENCES subscribers(id),
  status TEXT NOT NULL,                    -- QUEUED|ATTEMPTING|ACCEPTED|DELIVERED|DEFERRED|BOUNCED|COMPLAINED|FAILED|SKIPPED
  attempt_count INT NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, subscriber_id)
);
CREATE INDEX ON campaign_recipients (campaign_id, status);
CREATE INDEX ON campaign_recipients (provider_message_id);

CREATE TABLE email_events (
  id UUID PRIMARY KEY,
  provider_event_id TEXT UNIQUE,           -- dedupe key
  campaign_id UUID,
  recipient_id UUID,
  type TEXT NOT NULL,                      -- DELIVERED|BOUNCE_HARD|BOUNCE_SOFT|COMPLAINT|OPEN|CLICK|UNSUBSCRIBE
  payload JSONB,
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE suppressions (
  id UUID PRIMARY KEY,
  publication_id UUID,                     -- NULL = global
  email CITEXT NOT NULL,
  reason TEXT NOT NULL,                    -- HARD_BOUNCE|COMPLAINT|UNSUBSCRIBE|MANUAL
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (publication_id, email, reason)
);

CREATE TABLE outbox_events (
  id UUID PRIMARY KEY,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);
CREATE INDEX ON outbox_events (published_at) WHERE published_at IS NULL;

CREATE TABLE daily_campaign_stats (
  campaign_id UUID NOT NULL,
  day DATE NOT NULL,
  accepted INT NOT NULL DEFAULT 0,
  delivered INT NOT NULL DEFAULT 0,
  bounced INT NOT NULL DEFAULT 0,
  complained INT NOT NULL DEFAULT 0,
  unsubscribed INT NOT NULL DEFAULT 0,
  opens INT NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  PRIMARY KEY (campaign_id, day)
);
```

### State machines (enforce in code; reject invalid transitions)

**Subscriber:**

```
PENDING ──confirm──► ACTIVE ──unsubscribe──► UNSUBSCRIBED
ACTIVE ──hard bounce──► BOUNCED
ACTIVE ──complaint──► COMPLAINED
UNSUBSCRIBED ──re-subscribe + re-confirm──► PENDING → ACTIVE
BOUNCED / COMPLAINED are suppressed; do not auto-reactivate.
```

**Campaign:**

```
DRAFT → SCHEDULED → SENDING ⇄ PAUSED → COMPLETED
DRAFT/SCHEDULED/SENDING/PAUSED → CANCELLED
SENDING → FAILED (only on unrecoverable error)
```

**Recipient:**

```
QUEUED → ATTEMPTING → ACCEPTED → DELIVERED
                     ↘ DEFERRED (retry) ↘ FAILED
ACCEPTED/DELIVERED → BOUNCED | COMPLAINED (via webhook)
QUEUED → SKIPPED (suppressed/unsubscribed at send time)
```

Rule: webhook events may arrive late or out of order. Never move a recipient from a terminal state (e.g. BOUNCED, COMPLAINED) back to a non-terminal one.

---

## 6. Public Publication ID (important concept)

- `public_id` (e.g. `pub_8f3k2j`) is **public, not secret**. It appears in the creator's website HTML.
- It can do **one thing only**: submit a subscribe request (creates a `PENDING` subscriber).
- It must **never** grant read access to subscribers or ability to send.
- Because it is public, protect the endpoint: rate limiting, honeypot, double opt-in, email validation, optional per-publication allowed-domains list (future).
- Use a random non-guessable ID (nanoid-style), not an auto-increment number.

**API keys are NOT in v1.** Creator access is via dashboard login only. See Future Work.

---

## 7. API design

Base path `/api/v1`. All dashboard endpoints require auth and **must verify the authenticated user owns the publication** (tenant isolation). Use pagination everywhere on list endpoints.

### Auth (decided: password + Google OAuth in v1, kebab action paths)

- `POST /api/auth/sign-up`, `POST /api/auth/sign-in`, `POST /api/auth/sign-out`, `POST /api/auth/refresh-token`, `GET /api/auth/me`, `POST /api/auth/password` (set password on OAuth-created accounts)
- `POST /api/auth/oauth/exchange` (one-time login code → session), `GET /api/auth/providers/link-token`, `GET /api/auth/providers`, `DELETE /api/auth/providers/{provider}` (unlink with last-credential guard)
- Passwords hashed with BCrypt (cost 12). Access token: short-lived JWT (15 min) in body + `Authorization` header. Refresh token: rotating JWT (30 d) in HttpOnly `SameSite=Lax` cookie only — never in body/URL. Rotation keeps the previous hash for a short grace window (concurrent-retry safe); replay after the window revokes the lineage (reuse detection, RFC 9700 §4.14.2). All token material stored as SHA-256 hashes.

### Publications (auth)

- `GET /publications`, `POST /publications`
- `GET /publications/{id}`, `PATCH /publications/{id}`, `DELETE /publications/{id}`

### Subscribers (auth)

- `GET /publications/{id}/subscribers?status=&q=&page=&size=`
- `DELETE /publications/{id}/subscribers/{sid}`
- `GET /publications/{id}/subscribers/export` (CSV)

### Campaigns (auth)

- `GET/POST /publications/{id}/campaigns`
- `GET/PATCH /campaigns/{cid}` (only editable while DRAFT)
- `POST /campaigns/{cid}/test-send`
- `POST /campaigns/{cid}/schedule`
- `POST /campaigns/{cid}/send`
- `POST /campaigns/{cid}/pause`, `/resume`, `/cancel`
- `GET /campaigns/{cid}/progress` (counts per recipient status; polled by the UI)
- `GET /campaigns/{cid}/stats`

### Analytics (auth)

- `GET /publications/{id}/stats/summary`
- `GET /publications/{id}/stats/timeseries?from=&to=`

### Public (no auth)

- `POST /public/subscribe` — body/form: `publicationId`, `email`, honeypot field `website` (must be empty), optional `source`
- `GET /public/confirm?token=...`
- `GET /public/unsubscribe?token=...` (page) and `POST /public/unsubscribe` (one-click, RFC 8058)
- `GET /public/p/{publicId}/archive` and `/archive/{campaignId}` (optional web archive)

### Webhooks (inbound from provider)

- `POST /webhooks/ses` — verify SNS/SES signature, dedupe by event/message ID, return 2xx quickly, process safely. Also provide a local simulator endpoint/tool for the Fake provider.

### Error format

Use RFC 7807 problem+json. Never leak whether an email already exists on the public subscribe endpoint (return the same response either way to avoid enumeration).

---

## 8. Core flows

### 8.1 Subscribe (double opt-in)

1. Form posts `publicationId` + `email` (+ honeypot) to `/public/subscribe`.
2. Server: validate payload, check honeypot, rate limit by IP and by publication, validate email syntax and (optionally) MX, check suppression.
3. Upsert subscriber as `PENDING`, record `source`, `consent_at`, `consent_ip`, store **hash** of confirm token.
4. Send confirmation email (via queue or directly) containing signed token link.
5. `/public/confirm` → set `ACTIVE`, `confirmed_at`.
6. Return a generic success response regardless of prior state.

### 8.2 Send a campaign

1. Creator clicks Send. In **one transaction**: validate campaign is `DRAFT`/`SCHEDULED`, set `SENDING`, snapshot audience (`ACTIVE` subscribers not suppressed) into `campaign_recipients` as `QUEUED`, insert outbox event(s).
2. **Outbox relay** publishes batch messages (e.g. 100–500 recipient IDs per message) to RabbitMQ and marks them published.
3. **Worker** consumes a message:
   - Check campaign is still `SENDING` (if `PAUSED`/`CANCELLED`, requeue-delay or skip).
   - For each recipient: atomically claim (`QUEUED → ATTEMPTING`), re-check suppression/unsubscribe, render personalized HTML (unsubscribe link + headers), call `EmailProvider.send`, store `provider_message_id`, set `ACCEPTED`.
   - Apply a **token-bucket rate limiter** matching provider send rate.
4. Transient failure → increment `attempt_count`, route to retry queue with backoff. Permanent failure or max attempts → `FAILED` + dead-letter queue.
5. When no recipients remain `QUEUED/ATTEMPTING/DEFERRED` → campaign `COMPLETED`.
6. **Crash recovery:** a scheduled job finds recipients stuck in `ATTEMPTING` beyond a timeout and returns them to `QUEUED`. Because sends are idempotent at the DB level and `provider_message_id` is stored, double-send risk is minimized (document the residual at-least-once edge case honestly).

### 8.3 Pause / resume

- Pause: set campaign `PAUSED`; workers stop claiming new recipients.
- Resume: set `SENDING`, re-enqueue outstanding `QUEUED` recipients via outbox.

### 8.4 Webhook processing

1. Verify signature; reject if invalid.
2. Insert into `email_events` with `provider_event_id` unique; on conflict, ignore (duplicate).
3. Map to recipient via `provider_message_id`.
4. Update recipient status only if transition is forward/valid.
5. Hard bounce → subscriber `BOUNCED` + suppression row. Complaint → subscriber `COMPLAINED` + suppression (global-aware). Soft bounce → keep, count.
6. Update rollups (async or incremental).

### 8.5 Unsubscribe

- Every email has a visible unsubscribe link and headers:
  - `List-Unsubscribe: <https://api.example.com/public/unsubscribe?token=...>, <mailto:...>`
  - `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
- Tokens are signed (HMAC) and bound to `(subscriber_id, campaign_id)`.
- On unsubscribe: set `UNSUBSCRIBED`, add publication-level suppression, effective immediately. Workers re-check before each send.

### 8.6 Authentication and account linking (decided)

- Signup is email + password (BCrypt) or Google OAuth; Google-only accounts have `password_hash = NULL`.
- OAuth never puts tokens in redirect URLs: the provider callback mints a single-use 5-minute login code, the SPA exchanges it at `/api/auth/oauth/exchange` for the cookie session. Unknown Google identity auto-creates a `CREATOR` account (Google always supplies email); known identity logs in.
- Linking (modern-SaaS connected accounts): a signed-in user fetches a 5-minute link token (`GET /api/auth/providers/link-token`), completes Google OAuth, and the exchange binds the Google identity to the current account — rejected with 409 if that Google account belongs to someone else. This covers "signed up with email, connect Google later from settings" and the reverse.
- Unlinking (`DELETE /api/auth/providers/{provider}`) is refused when it would remove the last credential (409); OAuth-only users gain password login via `POST /api/auth/password`, which also rotates the session.
- `GET /api/auth/providers` (+ `hasPassword`, `GET /api/auth/me`) drives the settings UI state.

---

## 9. Messaging topology (RabbitMQ)

- Exchange `campaign.send` (direct) → queue `campaign.send.batch`
- Retry queues with TTL + dead-letter back to main queue: `campaign.send.retry.1m`, `.5m`, `.30m`
- Dead-letter queue `campaign.send.dlq` (manual review in admin UI/logs)
- Manual acks; **prefetch** bounded (e.g. 5–20); bounded worker concurrency
- Messages carry IDs only (campaign ID, recipient IDs), never full content; load state from DB
- Consumers must be idempotent

---

## 10. Analytics

Start with PostgreSQL only.

**Dashboard metrics:** attempted, provider-accepted, delivered (when confirmed), bounced, complained, unsubscribed, opens, clicks.

**Rules:**

- Define each metric precisely in docs ("accepted" ≠ "inbox placement").
- **Opens are unreliable** (Apple Mail Privacy Protection, image proxies). Label them as estimates in UI.
- **Clicks can be inflated** by security scanners. Add basic filtering (very fast clicks after delivery, known scanner user agents) and document its limits.
- Use **daily/campaign rollup tables** (`daily_campaign_stats`) instead of scanning raw events for every dashboard request.
- Tracking pixel and click-redirect endpoints are optional for v1; implement clicks first if time is short.

---

## 11. Security and abuse requirements

- TLS in production; secrets via environment/secret store, never committed (`.env` files are git-ignored; only `.env.example` is committed)
- CORS locked to the exact dashboard origin (required for credentialed cookie requests); refresh cookie is `HttpOnly` + `SameSite=Lax` (never `None`), which is what makes cookie-based refresh CSRF-safe
- **Tenant isolation:** every repository query scoped by publication/owner; write tests that attempt cross-tenant access and expect 403/404
- Rate limiting on public endpoints (Bucket4j or reverse proxy such as Cloudflare); per IP and per publication
- Honeypot field; CAPTCHA (e.g. Turnstile) as optional upgrade
- Hash tokens at rest (confirm tokens); sign unsubscribe tokens (HMAC); constant-time comparison
- Input validation, parameterized queries, output encoding
- Sanitize creator-provided HTML/editor content before rendering
- CORS: allow only the dashboard origin for authenticated endpoints; public subscribe may allow any origin but must not rely on cookies
- Audit log for important actions (campaign send/pause/cancel, exports, publication deletion)
- Privacy: consent records, subscriber deletion/export, retention policy

---

## 12. Frontend (Next.js)

### Stack

Next.js (App Router), React, TypeScript, Tailwind, shadcn/ui, TanStack Query (polling for campaign progress), Recharts, TipTap (or Markdown editor + preview), next-themes.

### Rendering approach

- Dashboard pages: client components calling the Spring Boot API
- Public pages (confirm, unsubscribe result, web archive): server-rendered

### Pages

1. Login / Signup
2. Publications list + create
3. Publication settings: **Publication ID (with copy button)**, **embeddable subscribe-form snippet (prefilled with real ID, copy button)**, sender name/address, reply-to. _(No API keys section in v1.)_
4. Subscribers table: search, status filter, pagination, CSV export
5. Campaign editor: subject, content, preview, send test, schedule, send
6. Campaign detail: live progress (queued/accepted/delivered/bounced/complained/failed), pause/resume/cancel
7. Analytics: summary cards + time-series chart, with a note that opens are estimates
8. Settings: account, theme toggle, connected Google account (link/unlink), set password for OAuth-created accounts (backend ready; frontend wiring pending)

### Embeddable subscribe snippet (plain HTML for v1)

```html
<form action="https://api.yourapp.com/api/v1/public/subscribe" method="POST">
  <input type="hidden" name="publicationId" value="pub_8f3k2j" />
  <input type="email" name="email" placeholder="you@example.com" required />
  <!-- honeypot: hidden from humans; bots tend to fill it -->
  <input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off" />
  <button type="submit">Subscribe</button>
</form>
```

A JS widget (`embed.js`) is future work.

### Theme (light: white + orange, dark: black + lime)

Use Tailwind with CSS variables and class-based dark mode via `next-themes`. Define variables so shadcn/ui picks them up.

| Token                  | Light     | Dark      |
| ---------------------- | --------- | --------- |
| `--background`         | `#FFFFFF` | `#0A0A0A` |
| `--card` / surface     | `#FFF7ED` | `#171717` |
| `--foreground`         | `#1C1917` | `#FAFAFA` |
| `--primary`            | `#EA580C` | `#A3E635` |
| `--primary-foreground` | `#FFFFFF` | `#0A0A0A` |
| `--border`             | `#FED7AA` | `#262626` |

Notes: use orange-600 (`#EA580C`) so white button text stays readable; use dark text on lime buttons; check contrast (WCAG AA).

### Frontend philosophy

Keep it **thin and clean**. Do not spend weeks on UI polish; the backend guarantees are the selling point. A live campaign-progress screen that survives a worker crash is the best demo.

---

## 13. Observability

- Actuator + Micrometer metrics: queue depth, send rate, send latency, failed jobs, DLQ size, webhook processing lag, outbox backlog
- Structured logs with correlation IDs (`campaignId`, `recipientId`)
- Prometheus + Grafana dashboards in `docker-compose` (optional profile)
- Alerts (documented): DLQ non-empty, outbox backlog growing, bounce/complaint rate above threshold

---

## 14. Testing strategy

**Must have:**

- Unit tests for state machines (valid/invalid transitions)
- Integration tests with **Testcontainers** (Postgres + RabbitMQ)
- Tenant isolation tests (user A cannot read/modify user B's data)
- Idempotency test: same message delivered twice → one email
- Webhook tests: duplicate events, out-of-order events, invalid signature
- Unsubscribe race: unsubscribe during an in-flight campaign → no email sent after unsubscribe is committed (or documented edge case)
- Failure injection: kill worker mid-campaign → resume with zero duplicates and zero lost recipients
- Pause/resume correctness
- **Load test (k6/Gatling):** e.g. 100k recipients against the Fake provider; record throughput, duplicate count (target 0), and p95 API latency; put results in README
- Email rendering check (manual): Gmail, Outlook, Apple Mail

CI: GitHub Actions running build + tests on every push.

---

## 15. Repository layout (suggested)

```
newsletter-saas/
├── backend/                  # Spring Boot
│   ├── src/main/java/.../
│   │   ├── auth/
│   │   ├── publication/
│   │   ├── subscriber/
│   │   ├── campaign/
│   │   ├── delivery/         # workers, recipient state, rate limiter
│   │   ├── provider/         # EmailProvider + Fake/Smtp/Ses impls
│   │   ├── webhook/
│   │   ├── suppression/
│   │   ├── analytics/
│   │   ├── outbox/
│   │   └── common/           # errors, security, config
│   └── src/main/resources/db/migration/   # Flyway
├── frontend/                 # Next.js
├── load-tests/               # k6 / Gatling scripts
├── infra/                    # prometheus/grafana configs
├── docs/                     # architecture diagram, ADRs, metric definitions
├── docker-compose.yml        # postgres, rabbitmq, mailpit, backend, worker, frontend
└── README.md
```

`docker compose up` should start everything with the Fake/Mailpit provider and need **no paid accounts**.

---

## 16. Build phases

1. **Foundation:** repo, Docker Compose, Flyway, auth (password + Google OAuth, linking), publications, tenant-isolation pattern
2. **Subscribers:** public subscribe endpoint, double opt-in, lifecycle, abuse controls, subscribers UI
3. **Campaigns and sending:** editor, campaign state machine, outbox, RabbitMQ worker, per-recipient state, provider interface, progress UI
4. **Feedback loop:** webhooks, suppression, one-click unsubscribe, bounce/complaint handling
5. **Analytics:** event tables, rollups, dashboard charts
6. **Hardening:** failure tests, load test, observability, CI, README with diagram and design decisions, optional SES sandbox demo

---

## 17. Architecture Decision Records (summary)

**ADR-001: RabbitMQ over Kafka.** Sending is a task-queue problem (acks, retries, DLQ, per-job processing). Kafka is a replayable event log suited to high-volume streams with multiple consumers. The real bottlenecks are provider rate limits, sender reputation, and DB writes, not queue throughput. Revisit Kafka only for the _event stream_ when events reach tens of millions/day, multiple independent consumers appear, or replay is required. Do not run both in v1.

**ADR-002: PostgreSQL for analytics first.** Avoid extra vendors. Use rollups when queries slow down.

**ADR-003: Transactional outbox.** Guarantees the DB change and the queue publish cannot diverge.

**ADR-004: Provider interface.** SES requires production-access approval and domain verification; abstraction keeps dev free and the provider swappable.

**ADR-005: Next.js + Spring Boot (separate).** Next.js for dashboard and SSR public pages; Spring Boot owns all business logic and data.

**ADR-006: No API keys in v1.** Dashboard auth is sufficient. Future: hashed, publication-scoped, revocable keys shown once.

**ADR-007: Public Publication ID is non-secret.** It can only create pending subscribers; protected by rate limits, honeypot, double opt-in.

**ADR-008: Google OAuth is in v1 (decided).** Password + Google login, link/unlink from settings, one-time-code exchange — tokens never travel in redirect URLs. Other providers (Facebook, GitHub, …) are future work.

**ADR-009: Mail delivery is Fake (tests/dev) + SMTP-via-Mailpit (local) + SES (prod only).** No other mail path; SES credentials and sandbox approval are production concerns, never needed locally.

**Recorded implementation facts:** Spring Boot 4.1.1 (uses Jackson 3, `tools.jackson` package), Java 25, jjwt 0.13.0, `spring-boot-starter-oauth2-client`; entities use Lombok `@Getter/@Setter` (not `@Data` — identity semantics); errors are RFC 7807 `ProblemDetail`; local Postgres publishes on host port **5433** (a system Postgres already owns 5432).

---

## 18. Future work (put in README, do not build now)

- API keys (hashed storage, publication scope, revoke, show-once)
- Additional OAuth providers (Facebook, GitHub, …)
- JS embed widget, allowed-domains list, CAPTCHA
- Segments, tags, custom fields
- A/B subject testing, automations/welcome sequences
- Paid tiers (Stripe)
- Dedicated IP, IP/domain warming, blocklist monitoring, feedback-loop registration
- Bounce classification beyond hard/soft
- Kafka for event streaming (see ADR-001)
- Real-time collaboration, AI writing assistance

---

## 19. Cost notes (planning only; re-check pricing before launch)

- Local/resume demo: ₹0 (Docker, Mailpit, Fake provider)
- Small VPS: roughly ₹700–₹2,000/month; off-server backups ₹100–₹500+/month
- SES: roughly US$0.10 per 1,000 emails (verify current rates and eligibility)
- Cloudflare free plan, Sentry free tier to start
- Operator time is the real cost

---

## 20. Resume bullet (template)

> Built a multi-tenant newsletter platform (Spring Boot, PostgreSQL, RabbitMQ, Next.js) with transactional-outbox queue-based sending, idempotent per-recipient delivery, signed webhook ingestion, one-click unsubscribe, and suppression handling. Sustained 100k-recipient campaigns in load tests with zero duplicate sends under injected worker failures.

Replace numbers with real measured results.

---

## 21. Instructions for the LLM assistant

- Follow the locked stack and scope above. Do not add Kafka, payments, API keys, or out-of-scope features unless asked.
- Prefer simple, readable code with clear package boundaries. Keep business logic out of controllers.
- Always scope data access by publication/owner; flag any query that is not.
- Every send path must go through `EmailProvider` and respect suppression + idempotency.
- When writing migrations, use Flyway with incremental versions; never edit applied migrations.
- When unsure about a requirement, state the assumption explicitly rather than inventing features.
- Do NOT write tests unless explicitly asked. When tests are requested, generate them alongside code, especially for state transitions, idempotency, webhooks, and tenant isolation.
- Do NOT run `docker compose up` (or any container commands) unless explicitly asked.
- context.md is a living spec, not final: decisions recorded in §22 override earlier sections on conflict.

---

## 22. Decision log (read this first when rebuilding context)

Dated decisions, newest last. On any conflict with §§1–21, this section wins.

- **2026-10-16 — Frontend migrated to Next.js 16.** Old UI was TanStack Start (Lovable-generated, `newsflow-source/`), migrated into `frontend/` (Next 16.4.2 App Router, React 19, `cacheComponents` + partial prefetching on). Route mapping: TanStack file routes → `app/` pages; `head()` → `metadata`; `Link to` → `Link href`; `useNavigate` → `useRouter`; params via awaited server `params` (NOT `useParams` — breaks prerender); `useSearchParams` under `<Suspense>`. Recharts upgraded 2.15.4 → **3.10.1** (`ui/chart.tsx` rewritten for v3 types). `PageSkeleton` kept as `app/dashboard/loading.tsx`; fake-delay `usePageReady` hook deleted. Build + tsc + eslint clean (1 informational RHF warning).
- **2026-10-16 — Backend auth ported from Ankuram, adapted.** Source: `C:\Data\Projects\Ankuram\backend` (Boot 3.5.7, jjwt 0.13.0, JWT + Google/Facebook OAuth). Kept: endpoint paths (`sign-up/sign-in/sign-out/refresh-token`), service/method names, `JwtService` API, entity/DTO names, Lombok style. SwiftKite: `backend/`, package `com.swiftkite` (flat, no wrapper), app class `SwiftkiteApplication` → renamed `SwiftKiteApplication`, Boot **4.1.1**, Java 25.
- **2026-10-16 — OAuth2 (Google-only) is mandatory in v1.** One-time-code exchange (tokens never in redirect URLs), auto-create on first login, link/unlink from settings, `POST /api/auth/password` for OAuth-created accounts, last-credential guard. Facebook, pending-registration flow, phone-OTP, referral/RBAC-permissions NOT ported. `SecurityConfig` matches Ankuram structure (unconditional `oauth2Login`; Google keys fail fast when unset).
- **2026-10-16 — Session transport.** Access JWT (15 min) in body + `Authorization` header; refresh JWT (30 d, rotating) in HttpOnly `SameSite=Lax` cookie only. Hashes at rest (SHA-256), previous-hash grace window (concurrent-retry safe), replay-after-window revokes lineage (RFC 9700 §4.14.2).
- **2026-10-16 — Errors are RFC 7807 `ProblemDetail`** (not Ankuram's `Response<T>` envelope); `BadCredentialsException` → 401.
- **2026-10-16 — Mail: Mailpit for local dev, SES prod-only.** `SmtpEmailProvider` (JavaMail) + `FakeEmailProvider` + `SesEmailProvider`. `spring-boot-starter-mail` in pom; no mail code until Phase 2. No committed `.env` (`.env.example` only).
- **2026-10-16 — Entities: Lombok `@Getter/@Setter` on JPA entities** (never `@Data` — identity semantics); `@Data` allowed on DTOs.
- **2026-10-16 — Boot 4 Jackson split.** App code uses Jackson 3 (`tools.jackson`); jjwt 0.13.0 brings Jackson 2 runtime-only — no conflict, do not "fix" by downgrading.
- **2026-10-16 — Infra.** `docker-compose.yml` at repo root: postgres:17 (host **5433**, because a system Postgres owns 5432), rabbitmq:4-management, mailpit. Backend defaults aligned (DB `local_dev_password`, rabbitmq swiftkite/*). Healthchecks verified by reading only — compose NOT run (standing instruction).
- **2026-10-16 — No tests until asked.** Test files deleted; testcontainers deps removed from pom. Re-add (`testcontainers-bom` 1.21.3 + pg + junit-jupiter + `spring-boot-testcontainers`) when testing is requested.
- **2026-10-16 — Schema review rulings (domain schema not yet merged).** Dropped `users.terms_accepted_at` and `users.last_login_at` (no v1 need). No user-deletion flow at all → `publications.owner_id` FK stays action-less (restrict-by-default is the safe correct behavior; cascade question ignored). `updated_at` via Hibernate `@UpdateTimestamp` only (no `set_updated_at()` DB trigger). Webhook ingestion uses a **`webhook_inbox` staging table** (same reasoning as the outbox: verify → store → 2xx fast, `@Scheduled` poller processes later, failures replayable). No `campaigns.content_text` column — plain-text MIME part generated at send time from HTML. `subscriber_activity` table **dropped entirely** (no reader planned).
- Be honest about limits (opens unreliable, inbox placement not guaranteed, at-least-once delivery edge cases).
