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
│ Auth / Audit Engine / Math   │
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
│ Orchestration / Integrations │
└──────┬────────┬──────────────┘
       │        │
      AI      Gmail
       │
   Backend REST (audit, rates, persist)
```

Statement files for MVP are stored on the **local filesystem** (paths recorded in MySQL).

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
- Business rules that belong in the application layer.
- Local filesystem upload storage.
- **Deterministic royalty calculation and discrepancy detection** (single source of truth for math).
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
- Invoke AI extraction/generation (non-authoritative for money).
- Parse/ingest statement data and call **backend audit APIs** for rate lookup, calculation, and persistence.
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
Extract / Normalize (n8n; AI optional)
 ↓
Backend Audit Engine
   ├── Rate lookup (MySQL demo rates)
   ├── Deterministic calculation
   └── Discrepancy detection
 ↓
MySQL (rows, audit, discrepancies)
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
- Gmail (dispute email demo)
- AI provider (extraction, classification, dispute drafting)

**Not MVP:** live streaming platform APIs, payment gateways, Google Drive (optional future enhancement).

Demo royalty rates live in **MySQL**, read by the backend during audits.

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
