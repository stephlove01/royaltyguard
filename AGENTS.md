# RoyaltyGuard — AI Coding Agent Instructions

## 1. Project Context

RoyaltyGuard is a **capstone/demo** full-stack music royalty audit and dispute automation system. All artists, statements, rates, and payment amounts are **fictional** unless explicitly labeled otherwise. **No real payments** and **no live streaming platform APIs.**

Stack:
- React + TypeScript + Vite
- Node.js + Express + TypeScript
- MySQL (demo royalty rates)
- n8n (ingestion/automation—not authoritative math)
- AI/LLM (extract, classify, draft only)
- Gmail (after user approves dispute send)
- Local filesystem (MVP statement storage)

## 2. Architecture Rules

- Frontend must not connect directly to MySQL.
- Backend owns database access.
- n8n owns workflow orchestration.
- MySQL is the system of record.
- **Backend** must perform all deterministic royalty calculations and discrepancy detection.
- n8n and LLMs must not independently calculate financial results.
- AI must not perform authoritative financial calculations.
- External integrations must be configurable.
- Do not add payment gateways, OAuth (MVP), Redis, Kubernetes, or live streaming APIs unless explicitly approved.

## 3. Before Coding

Read:
1. `PRD.md`
2. `SYSTEM_ARCHITECTURE.md`
3. `TECHNICAL_SPECIFICATION.md`
4. relevant document for the requested task
5. `TASKS.md`

Identify the relevant TASK ID before implementation.

## 4. Coding Rules

- Prefer simple, maintainable solutions.
- Do not introduce new frameworks without a documented reason.
- Reuse existing utilities/components.
- Validate all external input.
- Handle errors explicitly.
- Never hard-code secrets.
- Do not break existing API contracts without updating documentation.
- Do not change database schema without a migration.

## 5. AI Rules

AI may:
- extract data
- classify
- summarize
- draft text

AI must not:
- invent royalty rates
- invent transaction values
- change verified financial calculations
- make unsupported legal claims

All structured AI output must be validated.

## 6. Financial Rules

Use deterministic calculations.

Do not replace code such as:

```text
expected = units × rate
difference = expected - actual
```

with an LLM-generated answer.

Use decimal-safe handling for money.

## 7. Database Rules

- Use migrations.
- Use foreign keys.
- Use appropriate indexes.
- Use DECIMAL for money.
- Avoid destructive schema changes unless explicitly approved.

## 8. API Rules

- Validate request bodies and parameters.
- Use consistent status codes.
- Return structured errors.
- Never expose internal stack traces/secrets.

## 9. Frontend Rules

- Use the API layer.
- Handle loading/error/empty states.
- Keep components reusable.
- Maintain accessibility.
- Do not duplicate backend business rules in the UI.

## 10. n8n Rules

Every workflow should document:
- trigger
- inputs
- nodes
- outputs
- credentials
- retries
- error path
- idempotency strategy

Use descriptive node names.

## 11. Documentation Rules

When changing:
- database → update `DATABASE_DESIGN.md`
- API → update `API_SPECIFICATION.md`
- architecture → update `SYSTEM_ARCHITECTURE.md`
- n8n → update `AI_N8N_SPECIFICATION.md`
- product behavior → update `PRD.md`
- task progress → update `TASKS.md`

Important technical decisions belong in `DECISIONS.md`.

## 12. Completion Report

After implementation, report:

```text
TASK:
Changed:
Tests:
Result:
Known issues:
Next task:
```

Do not claim tests passed unless they were actually run.
