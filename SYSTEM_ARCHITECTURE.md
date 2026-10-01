# RoyaltyGuard — System Architecture

RoyaltyGuard is a **capstone demo**: fictional financial data, simulated streaming platforms (CSV statements only), no real payments, no live platform APIs.

## 1. Architecture Overview

RoyaltyGuard uses a full-stack architecture with clear separation between the user interface, application API, database and automation layer.

```text
┌──────────────────────────────┐
│        React Frontend        │
│ Dashboard / Upload / Audits  │
└──────────────┬───────────────┘
               │ REST API
               ▼
┌──────────────────────────────┐
│     Node.js + Express API    │
│ Auth / Statements / Persistence │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│            MySQL             │
│ Statements / Audits / etc.  │
└──────────────┬───────────────┘
               ▲
               │
┌──────────────┴───────────────┐
│             n8n              │
│ Orchestration / Audit / Integrations │
└──────┬────────┬──────────────┘
       │        │
      AI      Gmail
       │
   Rate API → n8n Code → Backend REST (persist)
```

Frontend-uploaded statement files for MVP are stored on the **local filesystem**. Google Drive-triggered source files remain in Drive; the backend stores their source URI and metadata.

## 2. Components

### Frontend
React + Vite + TypeScript + Tailwind CSS.

Responsibilities:
- Authentication UI.
- Statement upload.
- Dashboard.
- Audit results.
- Discrepancy list.
- Dispute review.
- Status display.
- API communication.

The frontend must never connect directly to MySQL.

### Backend
Node.js + Express + TypeScript.

Responsibilities:
- REST API.
- Input validation.
- Authentication/authorization.
- Database access.
- Application/API validation and authorization.
- Local filesystem upload storage.
- Persist n8n-produced audit and discrepancy results through the protected TASK-067 backend API without recomputation.
- Existing deterministic audit services for backend/API support, regression tests, and future fallback; these are not called for royalty math by the primary n8n workflow.
- n8n integration endpoints/webhooks where required.

### Database
MySQL.

Responsibilities:
- System of record.
- Users/artists.
- Statements.
- Tracks/royalty rows.
- Rates.
- Audits.
- Discrepancies.
- Disputes.

### n8n
n8n is the automation/orchestration layer.

Responsibilities:
- Receive triggers.
- Coordinate external services.
- Extract files and use the installed Information Extractor node to map statement fields into the canonical schema; validate its structured output.
- Retrieve applicable platform/territory/period rates through the protected backend rate-data API; the current local adapter reads seeded demo rates through `royaltyRateService`.
- Perform primary deterministic royalty calculations and discrepancy-threshold decisions in an n8n Code node and IF node. AI never performs financial math.
- Submit statement metadata and normalized rows to the backend; persist computed audit results through `POST /api/webhooks/n8n/audit-results`.
- Send Gmail messages **only after the user explicitly approves send** (typically triggered via backend → n8n).
- Schedule follow-ups.
- Handle retryable workflow failures.

### AI
AI is used for:
- Unstructured statement extraction.
- Normalization assistance.
- Drafting dispute correspondence.
- Classification/summarization.

AI must not be the source of truth for financial arithmetic.

## 3. Data Flow

### Statement Audit

```text
User uploads simulated platform CSV
 ↓
Frontend → POST /api/statements
 ↓
Backend stores file (local) + metadata → MySQL
 ↓
n8n trigger (ingestion)
 ↓
Extract From File
 ↓
Information Extractor → canonical rows
 ↓
Backend statement/row intake (metadata and inputs only)
 ↓
HTTP rate provider (platform + territory + tier + statement period)
 ↓
n8n Code (expected payout, difference, shortfall)
 ↓
IF threshold → discrepancy / no-discrepancy
 ↓
Backend persistence API for calculated results (TASK-067; future)
 ↓
MySQL (statements, rows, audits, discrepancies)
 ↓
Frontend dashboard
```

### Dispute

```text
Discrepancy
 ↓
AI draft (optional) → saved as draft in MySQL
 ↓
User reviews draft in UI
 ↓
User explicitly triggers send (API)
 ↓
n8n / Gmail
 ↓
Dispute status updated
```

## 4. Integration Boundaries

**MVP external systems:**
- Google Drive (statement CSV trigger/source)
- Protected backend rate-data endpoint (current local demo adapter; public production source remains unselected)
- AI provider (statement extraction; later classification/dispute drafting)
- Gmail for later user-approved dispute email

**Not MVP:** live streaming platform APIs and payment gateways.

The primary n8n workflow obtains rate data through `GET /api/webhooks/n8n/royalty-rate`, configured by `ROYALTYGUARD_RATE_API_URL`. The current local adapter reads seeded MySQL demo rates via `royaltyRateService` and returns rate data only; n8n performs the calculation and threshold decision. A public production rate source remains unselected.

All external integrations must be isolated behind configurable credentials and integration modules/workflows.

## 5. Reliability

Every workflow should consider:
- Timeouts.
- Retries.
- Duplicate events.
- Partial failure.
- Invalid input.
- External service failure.
- Human review requirements.

## 6. Idempotency

Important operations should use an idempotency key or equivalent uniqueness rule.

Examples:
- Same statement should not create duplicate processing records.
- Same webhook event should not create duplicate audits.
- Same dispute should not be sent twice accidentally.

## 7. Security Boundaries

- Frontend receives public API data only.
- Backend owns database credentials.
- **Authentication:** email + password (hashed) + JWT for API access; no OAuth for MVP.
- **n8n webhooks:** simple shared-secret validation (e.g. header checked against `N8N_WEBHOOK_SECRET`)—beginner-friendly, no complex auth infrastructure.
- n8n credentials are stored in n8n credential storage/environment configuration.
- Secrets are never committed to Git.
- Sensitive data should not be unnecessarily included in AI prompts.

## 8. Architectural Principle

Use the simplest architecture that satisfies the requirement.

Do not add Redis, Kubernetes, LangChain, LangGraph, microservices, complex event buses, or unnecessary cloud infrastructure unless a concrete requirement justifies it.
