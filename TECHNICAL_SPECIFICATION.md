# RoyaltyGuard — Technical Specification

Capstone/demo system: fictional financial data, no real payments, no live streaming APIs. Demo royalty rates in MySQL are not official platform rates.

## 1. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | MySQL |
| Automation | n8n |
| AI | LLM through n8n/backend integration |
| Email | Gmail (dispute send after user approval) |
| File Storage | Local filesystem (MVP) |
| Authentication | Email + password (hashed) + JWT |
| API Testing | Postman |
| Version Control | Git + GitHub |

## 2. Engineering Principles

1. Separate concerns.
2. Keep the primary n8n audit deterministic: retrieve rates through the configured HTTP provider and calculate/threshold in an n8n Code node. LLMs must never calculate financial results. The existing backend calculation services remain for API support and regression tests, not the primary n8n workflow.
3. Validate all external input.
4. Make workflows observable.
5. Prefer explicit contracts over implicit behavior.
6. Keep secrets out of source control.
7. Design for idempotency.
8. Write tests for business-critical logic.
9. Update documentation when architecture, API or schema changes.

## 3. Financial Calculation Rule

The primary n8n calculation engine must use explicit Code-node logic; AI output is extraction input only.

Example:

```text
expectedRoyalty = eligibleUnits × royaltyRate
difference = expectedRoyalty - actualPayout
```

For example, if:

```text
eligibleUnits = 100,000
royaltyRate = 0.004
actualPayout = 300
```

then:

```text
expectedRoyalty = 400
difference = 100
```

The example is for system testing only. It is not a claim about a real platform's contractual rate.

**Demo comparison (fictional):** expected royalty ₦1,250 vs reported ₦900 → difference ₦350 → discrepancy. No payment processing occurs.

**Example demo rates (MySQL seed, not official):** Spotify 0.004, Apple Music 0.006, YouTube Music 0.003, Audiomack 0.002.

## 4. Precision

Money values should not be calculated using unsafe floating-point assumptions.

Preferred approaches:
- Decimal database type.
- Decimal-safe calculation library in Node.js.
- Explicit rounding policy.

The n8n Code node uses integer cents and integer-scaled rate values. Expected
payouts are rounded half up to two decimal places before differences are
compared. The n8n workflow uses `ROYALTYGUARD_DISCREPANCY_THRESHOLD` (default
`0.00`) and flags underpayments only when expected minus actual is greater than
that threshold. A missing or invalid rate fails the workflow; it must never
default to zero. Existing backend calculation services retain their equivalent
rules for backend support and regression tests but are not called by the
primary n8n path.

## 5. Backend Structure

Suggested structure:

```text
backend/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   ├── repositories/
│   ├── models/
│   ├── middleware/
│   ├── validators/
│   ├── utils/
│   └── app.ts
├── tests/
└── package.json
```

## 6. Frontend Structure

```text
frontend/
├── src/
│   ├── components/
│   ├── pages/
│   ├── layouts/
│   ├── services/
│   ├── hooks/
│   ├── types/
│   ├── utils/
│   └── App.tsx
└── package.json
```

## 7. Error Handling

API errors should follow a consistent structure:

```json
{
  "success": false,
  "error": {
    "code": "STATEMENT_NOT_FOUND",
    "message": "Statement not found"
  }
}
```

Do not expose database internals or secrets in production error messages.

## 8. Configuration

Use environment variables for:
- Database connection.
- API port.
- Upload directory (local statement storage).
- JWT secret and token settings.
- AI credentials (when used).
- n8n webhook URLs.
- `ROYALTYGUARD_RATE_API_URL` for the backend's protected rate-data endpoint (local default: `/api/webhooks/n8n/royalty-rate`).
- `ROYALTYGUARD_DISCREPANCY_THRESHOLD` for the primary n8n threshold.
- `N8N_WEBHOOK_SECRET` (shared secret for inbound n8n → backend webhooks).
- Gmail credentials (via n8n or backend as implemented).

Google Drive and AI model credentials are stored in n8n and are required to run
the statement extraction workflow. The rate endpoint may require an n8n HTTP
credential configured for that provider.

Provide `.env.example`; never commit `.env`.

## 8.1 Authentication (MVP)

- Register/login with email and password.
- Store `password_hash` only (e.g. bcrypt)—never plain passwords.
- Issue JWT for authenticated API requests.
- No OAuth providers for MVP.
- No complex RBAC unless added later; default to authenticated user access to their data.

## 9. AI Guardrails

AI output must be schema-validated against the original source before any
downstream processing. For the current Information Extractor 1.2 node, each
source CSV item produces this strict intermediate row shape:

```json
{
  "rows": [
    {
      "trackName": "Example Track",
      "plays": 100000,
      "territory": "NG",
      "tier": null,
      "actualPayout": "300.00"
    }
  ]
}
```

`rows` is required, and each extractor result must wrap exactly one source row.
The row requires `trackName`, non-negative integer `plays`, non-empty
`territory`, and source-exact decimal-string `actualPayout`; `tier` is optional
and nullable. Additional properties are rejected. Deterministic workflow
validation matches each output to its original CSV item, rejects missing,
extra, duplicate, or changed mappings and AI-calculated financial fields, and
stops before rate retrieval/calculation on failure. The canonical backend row
contract remains `eligibleUnits` as a decimal digit string. Canonical
preparation reads that value and every other financial/row field from the
original CSV, never repairing source data from AI output.

Future dispute drafting may receive only verified, persisted audit and
discrepancy facts plus existing artist/account identity information. Inputs
must distinguish verified facts, inferences, and unknown information; only
verified facts may be stated as facts. The draft must not invent rates,
contracts, dates, obligations, policies, correspondence, identifiers,
territories, tiers, money, taxes, or conversions, or make legal conclusions or
accusations. It may not calculate or modify any financial value. Unavailable
details are omitted or explicitly identified as unavailable. Draft output is
`subject`, `body`, `facts_used`, and `missing_information`, remains draft-only,
and must be traceable to its persisted audit/discrepancy records. No dispute
Agent or send integration is added by TASK-071 through TASK-074.

The backend remains responsible for authentication, statement metadata/row
storage, APIs, and persistence of calculated results. The primary workflow
posts its generated result to `POST /api/webhooks/n8n/audit-results`; that
endpoint validates and persists the supplied values without recalculating
them. The primary workflow does not call the existing backend audit
calculation endpoint.

## 10. Definition of Done

A feature is complete when:
- Code is implemented.
- Validation exists.
- Tests exist where applicable.
- API/UI integration works.
- Errors are handled.
- Documentation is updated.
- No secrets are committed.
