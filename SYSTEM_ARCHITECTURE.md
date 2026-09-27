# RoyaltyGuard — System Architecture

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
│ Auth / Validation / Business │
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
└──────┬────────┬────────┬─────┘
       │        │        │
    Drive      AI      Gmail
```

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
- File metadata management.
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
- Invoke AI extraction/generation.
- Call backend APIs.
- Perform deterministic calculation steps where appropriate.
- Send Gmail messages.
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
User
 ↓
Frontend
 ↓
POST /api/statements
 ↓
Backend
 ↓
MySQL
 ↓
n8n trigger
 ↓
Extract
 ↓
Normalize
 ↓
Rate Lookup
 ↓
Deterministic Calculation
 ↓
Discrepancy Detection
 ↓
MySQL
 ↓
Frontend Dashboard
```

### Dispute

```text
Discrepancy
 ↓
n8n
 ↓
AI Draft
 ↓
Backend / Database
 ↓
User Review
 ↓
Gmail
 ↓
Dispute Status
```

## 4. Integration Boundaries

External systems:
- Google Drive
- Gmail
- AI provider
- Royalty-rate API/source

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
- n8n credentials are stored in n8n credential storage/environment configuration.
- Secrets are never committed to Git.
- Sensitive data should not be unnecessarily included in AI prompts.

## 8. Architectural Principle

Use the simplest architecture that satisfies the requirement.

Do not add Redis, Docker, LangChain, LangGraph, microservices or other infrastructure unless a concrete requirement justifies it.
