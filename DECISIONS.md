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
Backend reads rates from the database during audits; documentation and UI must not claim official platform rates.

---

## ADR-010 — Backend Owns All Royalty Calculations

**Status:** Accepted

### Decision
Deterministic calculation and discrepancy detection run only in the backend. n8n orchestrates; LLMs never independently compute financial results.

### Reason
Aligns with ADR-004 and keeps capstone logic reviewable in one codebase.

### Consequence
n8n workflows call backend audit APIs instead of Code-node math for royalties.

---

## ADR-011 — Local Filesystem Statement Storage (MVP)

**Status:** Accepted

### Decision
Store uploaded statement files on the local filesystem for MVP. Google Drive is a future optional enhancement only.

### Reason
Simplest approach for student development and demo deployment.

### Consequence
`storage_location` in MySQL references local paths; production deployment must secure upload directories.

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
