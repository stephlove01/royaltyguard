# RoyaltyGuard — API Specification

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

## 2. Health

### GET /api/health

Response:

```json
{
  "success": true,
  "status": "ok"
}
```

## 3. Statements

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

## 4. Audits

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

## 5. Discrepancies

### GET /api/discrepancies

Returns detected discrepancies.

### GET /api/discrepancies/:id

Returns complete discrepancy evidence.

## 6. Disputes

### POST /api/disputes

Creates a dispute draft.

### GET /api/disputes

Lists disputes.

### GET /api/disputes/:id

Returns dispute details.

### POST /api/disputes/:id/send

Sends an approved dispute through the configured email integration.

## 7. Webhooks / n8n

Where n8n needs to notify the backend, use dedicated webhook endpoints such as:

```text
POST /api/webhooks/n8n/statement-processed
POST /api/webhooks/n8n/audit-completed
POST /api/webhooks/n8n/dispute-updated
```

Webhook requests should be authenticated.

## 8. Status Codes

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

## 9. Validation

Use a schema-validation library in the backend.

Never trust:
- IDs from the client.
- File metadata.
- Money values.
- AI-generated fields.
- Webhook payloads.

## 10. Pagination

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
