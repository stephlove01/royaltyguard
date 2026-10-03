# RoyaltyGuard — Architecture Decision Log

## ADR-001 — Use MySQL

**Status:** Accepted

### Decision
Use MySQL as the primary relational database.

### Reason
RoyaltyGuard has structured relationships among users, artists, statements, royalty rows, audits, discrepancies and disputes.

### Consequence
The system must use migrations and enforce foreign-key relationships.

---

## ADR-002 — Use n8n for Orchestration

**Status:** Accepted

### Decision
Use n8n for workflow orchestration and external integrations.

### Reason
The project is specifically designed to demonstrate automation across AI, APIs, email and scheduled workflows.

### Consequence
n8n workflows must be documented and version-controlled where practical.

---

## ADR-003 — Separate Frontend, Backend and Automation

**Status:** Accepted

### Decision
React, Node/Express and n8n have separate responsibilities.

### Reason
This improves maintainability, testability and clarity.

### Consequence
The frontend does not connect directly to MySQL.

---

## ADR-004 — Deterministic Financial Calculations

**Status:** Accepted

### Decision
Financial calculations are performed by deterministic code.

### Reason
LLMs can produce inconsistent arithmetic or alter structured values.

### Consequence
AI can extract and draft, but verified financial inputs and calculation outputs remain controlled by application logic.

---

## ADR-005 — Start With a Controlled Statement Format

**Status:** Accepted

### Decision
The MVP begins with CSV/sample statements.

### Reason
It reduces extraction complexity while the core audit pipeline is being validated.

### Consequence
PDF and additional statement formats are later extensions.

---

## ADR-006 — Avoid Unnecessary Infrastructure

**Status:** Accepted

### Decision
Do not introduce Redis, microservices, LangChain/LangGraph or other infrastructure without a concrete requirement.

### Reason
Complexity should be justified by a product or technical need.

### Consequence
The initial implementation remains simple enough to understand and debug.

---

## ADR-007 — Capstone Demo Data Scope

**Status:** Accepted

### Decision
RoyaltyGuard is a capstone/demo system using entirely fictional artists, statements, rates, and payment figures. No real financial transactions.

### Reason
Students must build, test, explain, and defend a complete system without handling real money or contractual platform rates.

### Consequence
All UI and docs must distinguish demo data from real-world financial processing.

---

## ADR-008 — Simulated Streaming Platforms (CSV Only)

**Status:** Accepted

### Decision
Use platform names (Spotify, Apple Music, YouTube Music, Audiomack) for demonstration via fictional sample CSVs. Do not integrate live platform APIs.

### Reason
Capstone focus is audit pipeline and software engineering, not platform partnerships.

### Consequence
`sample-data/` holds small understandable CSV fixtures per platform.

---

## ADR-009 — Demo Royalty Rates in MySQL

**Status:** Accepted

### Decision
Store configurable fictional demo rates in MySQL (example seeds: Spotify 0.004, Apple Music 0.006, YouTube Music 0.003, Audiomack 0.002). Label them as non-official.

### Reason
Rates must be auditable and editable without implying real payout contracts.

### Consequence
The existing backend support audit reads rates from MySQL. The primary n8n workflow retrieves rates from its configured HTTP provider; the seeded values are not silently used by n8n. Documentation and UI must not claim the demo rates are official.

---

## ADR-010 — Backend Owns All Royalty Calculations

**Status:** Superseded by ADR-015

### Decision
The original decision made backend calculation and discrepancy detection the only financial path. It is retained here as historical context and is superseded by ADR-015 for the primary n8n audit workflow.

### Reason
Aligns with ADR-004 and keeps capstone logic reviewable in one codebase.

### Consequence
The backend audit service remains for backend/API support and regression tests. The primary n8n workflow no longer calls it for royalty math.

---

## ADR-011 — Local Filesystem Statement Storage (MVP)

**Status:** Accepted

### Decision
Store frontend-uploaded statement files on the local filesystem for MVP. The primary n8n path may ingest source files from Google Drive and persist their source URI/metadata without copying them into local upload storage.

### Reason
Simplest approach for student development and demo deployment.

### Consequence
`storage_location` may reference a local path or Google Drive source URI; production deployment must secure upload directories and Drive credentials.

---

## ADR-012 — Simple JWT Authentication

**Status:** Accepted

### Decision
Use email, hashed password, and JWT for MVP. No OAuth. No complex RBAC unless added later.

### Reason
Capstone needs auth demonstration without enterprise identity complexity.

### Consequence
Auth endpoints and JWT middleware are required in backend tasks.

---

## ADR-013 — Dispute Send Requires User Approval

**Status:** Accepted

### Decision
AI may draft disputes; the user must review and explicitly trigger send before n8n/Gmail sends email.

### Reason
Prevents automated sending of unreviewed correspondence in demos and mirrors responsible workflow design.

### Consequence
Dispute status remains draft until user send action; n8n send branch runs after approval.

---

## ADR-014 — n8n Webhook Shared Secret

**Status:** Accepted

### Decision
Authenticate n8n → backend webhooks with a shared secret (environment variable), validated on each request.

### Reason
Beginner-friendly security without full mTLS or OAuth for machine-to-machine calls.

### Consequence
Document header name and secret in `.env.example`; test rejection of invalid secrets.

---

## ADR-015 — n8n Owns the Primary Royalty Audit Calculation

**Status:** Accepted

### Decision
The primary n8n statement-audit workflow retrieves an applicable rate through a configurable HTTP provider, performs deterministic royalty calculation in a Code node, and applies the discrepancy threshold in the workflow. AI is limited to extraction and language tasks.

The backend remains responsible for authentication, application APIs, statement/row storage, and persistence of n8n-produced audit results. Existing backend calculation services remain available for backend/API support and regression tests but are not called for financial math by the primary n8n path.

### Reason
This restores the original automation architecture while retaining backend ownership of application data and avoiding two competing calculation engines in the normal workflow.

### Consequence
Configure `ROYALTYGUARD_RATE_API_URL` for the primary audit; its local default is the secret-protected backend rate-data endpoint using the seeded MySQL demo rates through `royaltyRateService`. It returns rate data only. The separate `POST /api/webhooks/n8n/audit-results` contract persists calculated n8n results without recomputation and uses the source file ID for idempotency.

---

## ADR-016 — Source-Authoritative AI Extraction and Dispute Drafts

**Status:** Accepted

### Decision
Gemini extraction uses a closed structured schema and is validated
deterministically against each original CSV row. Canonical financial and row
values are taken from the CSV after validation; AI output cannot repair or
replace source plays or payout. Future dispute drafting may use only verified
persisted audit/discrepancy facts and existing application identity data.

### Reason
Structured output alone does not establish source accuracy, and generated
dispute text must not introduce unsupported financial, contractual, or legal
claims.

### Consequence
Invalid, missing, extra, duplicate, or changed extraction rows stop before
rate retrieval and calculation. Future drafts must distinguish verified
facts, inferences, and unknown information, retain audit/discrepancy provenance,
and remain drafts until explicit user approval. This decision adds no dispute
Agent, Gmail node, or API contract.
