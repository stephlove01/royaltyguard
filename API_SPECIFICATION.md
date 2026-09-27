# RoyaltyGuard — API Specification

Capstone demo API: fictional financial data, no payment processing. Protected routes use JWT unless noted.

## 1. API Principles

- RESTful HTTP API.
- JSON request/response format unless file upload is required.
- Backend validates every request.
- Frontend never accesses MySQL directly.
- Consistent HTTP status codes.
- Version API routes where appropriate.

Base path:

```text
/api
```

## 2. Authentication

### POST /api/auth/register

Body: email, password, name (optional).

Creates user with hashed password.

### POST /api/auth/login

Body: email, password.

Returns JWT for subsequent requests (e.g. `Authorization: Bearer <token>`).

OAuth is **not** in MVP scope.

## 3. Health

### GET /api/health

Response:

```json
{
  "success": true,
  "status": "ok"
}
```

## 4. Statements

### POST /api/statements

Creates a statement record or accepts a statement upload.

Expected fields may include:
- artistId
- platform
- statementPeriod
- file

Response should include:
- statement id
- status
- metadata

### GET /api/statements

Returns statements with optional filters.

### GET /api/statements/:id

Returns statement details and processing status.

### POST /api/statements/:id/run-audit

Runs or completes backend deterministic audit (may also be invoked by n8n with service authentication). Persists audit and discrepancy records.

## 5. Audits

### GET /api/audits

Returns audits.

Supported query parameters may include:
- status
- statementId
- page
- limit
- sort

### GET /api/audits/:id

Returns:
- statement
- calculated totals
- discrepancies
- audit status

## 6. Discrepancies

### GET /api/discrepancies

Returns detected discrepancies.

### GET /api/discrepancies/:id

Returns complete discrepancy evidence.

## 7. Disputes

### POST /api/disputes

Creates a dispute draft.

### GET /api/disputes

Lists disputes.

### GET /api/disputes/:id

Returns dispute details.

### POST /api/disputes/:id/send

User **explicitly** triggers send after reviewing the draft. Backend coordinates email (e.g. n8n/Gmail). Must not send without this action.

## 8. Webhooks / n8n

Where n8n needs to notify the backend, use dedicated webhook endpoints such as:

```text
POST /api/webhooks/n8n/statement-processed
POST /api/webhooks/n8n/audit-completed
POST /api/webhooks/n8n/dispute-updated
```

Webhook requests must include a **shared secret** header (e.g. `X-Webhook-Secret`) matching server `N8N_WEBHOOK_SECRET`. Reject missing or invalid values with `401` or `403`.

## 9. Status Codes

- `200` successful read/action
- `201` created
- `202` accepted for asynchronous processing
- `400` invalid request
- `401` unauthenticated
- `403` unauthorized
- `404` not found
- `409` conflict/duplicate
- `422` validation failure
- `429` rate limited
- `500` internal error
- `502/503` external dependency failure

## 10. Validation

Use a schema-validation library in the backend.

Never trust:
- IDs from the client.
- File metadata.
- Money values.
- AI-generated fields.
- Webhook payloads.

## 11. Pagination

Collection endpoints should use:

```text
?page=1&limit=20
```

Response:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0
  }
}
```
