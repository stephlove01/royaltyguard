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
2. Keep financial calculations deterministic in the **backend**; n8n and LLMs must not independently compute royalty results.
3. Validate all external input.
4. Make workflows observable.
5. Prefer explicit contracts over implicit behavior.
6. Keep secrets out of source control.
7. Design for idempotency.
8. Write tests for business-critical logic.
9. Update documentation when architecture, API or schema changes.

## 3. Financial Calculation Rule

The calculation engine must use explicit code.

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

RoyaltyGuard audits use integer cents and integer-scaled rate values. Expected
payouts are rounded half up to two decimal places before totals and differences
are stored. This MVP uses a configurable `DISCREPANCY_THRESHOLD` (default
`0.00`) and flags underpayments where expected minus actual is greater than
that threshold. Missing effective rates fail the audit rather than defaulting
to zero. These demo rules should be reviewed before production use.

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
- `N8N_WEBHOOK_SECRET` (shared secret for inbound n8n → backend webhooks).
- Gmail credentials (via n8n or backend as implemented).

Google Drive credentials are **not** required for MVP (future enhancement only).

Provide `.env.example`; never commit `.env`.

## 8.1 Authentication (MVP)

- Register/login with email and password.
- Store `password_hash` only (e.g. bcrypt)—never plain passwords.
- Issue JWT for authenticated API requests.
- No OAuth providers for MVP.
- No complex RBAC unless added later; default to authenticated user access to their data.

## 9. AI Guardrails

AI output must be schema-validated before being trusted by downstream logic.

AI extraction should produce structured fields such as:

```json
{
  "platform": "demo_platform",
  "statementPeriod": "2026-Q1",
  "tracks": [
    {
      "trackName": "Example Track",
      "plays": 100000,
      "territory": "NG",
      "actualPayout": 300
    }
  ]
}
```

If required fields are missing or invalid, the workflow should stop or route to review.

## 10. Definition of Done

A feature is complete when:
- Code is implemented.
- Validation exists.
- Tests exist where applicable.
- API/UI integration works.
- Errors are handled.
- Documentation is updated.
- No secrets are committed.
