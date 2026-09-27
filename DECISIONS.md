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
